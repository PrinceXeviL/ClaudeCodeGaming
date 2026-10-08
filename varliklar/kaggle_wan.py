"""Düşman ve iskelet animasyon videolarını Kaggle'ın ücretsiz ekran kartında (haftada 30 saat) üretir.

    <venv>/bin/python varliklar/kaggle_wan.py            # eksik bütün yürüyüş/saldırı şeritleri (video_uret.modal_jobs listesi)
    <venv>/bin/python varliklar/kaggle_wan.py --dene 2   # yalnız ilk 2 iş (deneme)

Akış: işler (referans görseller gömülü) tek bir Kaggle betiğine yazılır → `kaggle kernels push` (gizli, GPU, internet açık)
→ bitene kadar beklenir → videolar indirilir (varliklar/ham/anim/<ad>.mp4) → video_uret.process şeride çevirir.
Model: Wan 2.2 I2V A14B, Lightx2v 4 adım damıtılmış, GGUF Q4_K_M (jayn7/...) — 16 GB'lık T4'e sığar.
Anahtar: ~/.kaggle/access_token (depoya girmez).
"""
import base64, json, os, subprocess, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'varliklar', 'ham', 'anim')
KAGGLE = os.path.join(os.path.dirname(sys.executable), 'kaggle')
SLUG = 'nm-wan-anim'

KERNEL = r'''
import base64, json, os, subprocess, sys, time
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers', 'transformers', 'accelerate', 'gguf', 'ftfy',
                'imageio', 'imageio-ffmpeg', 'hf_transfer', 'sentencepiece'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])  # Kaggle'daki eski torchao yeni diffusers'ı bozuyor; gerek yok
os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'
import io, gc, torch
from PIL import Image
from huggingface_hub import hf_hub_download
from diffusers import WanImageToVideoPipeline, WanTransformer3DModel, AutoencoderKLWan, GGUFQuantizationConfig, FlowMatchEulerDiscreteScheduler
from diffusers.utils.export_utils import export_to_video
from transformers import UMT5EncoderModel, AutoTokenizer

JOBS = json.loads(base64.b64decode('__JOBS__'))
BASE = 'Wan-AI/Wan2.2-I2V-A14B-Diffusers'
G = 'jayn7/WAN2.2-I2V_A14B-DISTILL-LIGHTX2V-4STEP-GGUF'
import glob
REFS = os.path.dirname(glob.glob('/kaggle/input/**/*_ref.png', recursive=True)[0])  # referans görseller (veri seti)
os.makedirs('/kaggle/working/out', exist_ok=True)
t0 = time.time()
log = lambda *a: print(f'[{time.time() - t0:6.0f}s]', *a, flush=True)
log('GPU', [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())])

# 1) metinler: kodlayıcı yalnız başta yüklenir, bütün istemler kodlanır, sonra bellekten atılır
tok = AutoTokenizer.from_pretrained(BASE, subfolder='tokenizer')
te = UMT5EncoderModel.from_pretrained(BASE, subfolder='text_encoder', torch_dtype=torch.float16).to('cuda')
def enc(p):
    t = tok([p], padding='max_length', max_length=512, truncation=True, add_special_tokens=True, return_tensors='pt')
    with torch.no_grad():
        e = te(t.input_ids.to('cuda'), t.attention_mask.to('cuda')).last_hidden_state
    n = int(t.attention_mask.sum())
    e = torch.cat([e[:, :n], e.new_zeros(1, 512 - n, e.shape[-1])], 1)
    return e.cpu()
EMB = [enc(j['prompt']) for j in JOBS]
del te; gc.collect(); torch.cuda.empty_cache()
log('istemler kodlandı', len(EMB))

# 2) iki uzman (yüksek / düşük gürültü), GGUF Q4
def tr(kind, sub):
    p = hf_hub_download(G, f'{kind}_noise_260412/wan2.2_i2v_A14b_{kind}_noise_lightx2v_4step_720p_260412-Q4_K_M.gguf')
    return WanTransformer3DModel.from_single_file(p, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.float16),
                                                  config=BASE, subfolder=sub, torch_dtype=torch.float16)
t1 = tr('high', 'transformer'); t2 = tr('low', 'transformer_2')
vae = AutoencoderKLWan.from_pretrained(BASE, subfolder='vae', torch_dtype=torch.float32)
sch = FlowMatchEulerDiscreteScheduler(shift=5.0)
pipe = WanImageToVideoPipeline(tokenizer=tok, text_encoder=None, vae=vae, scheduler=sch, transformer=t1, transformer_2=t2, boundary_ratio=0.9)
pipe.enable_model_cpu_offload()
log('model hazır')

for j, emb in zip(JOBS, EMB):
    im = Image.open(os.path.join(REFS, os.path.basename(j['ref']))).convert('RGB').resize((832, 480))
    kw = dict(last_image=im) if j.get('loop') else {}
    try:
        fr = pipe(image=im, prompt_embeds=emb.to('cuda', torch.float16), height=480, width=832, num_frames=j.get('frames', 33),
                  guidance_scale=1.0, guidance_scale_2=1.0, num_inference_steps=4,
                  generator=torch.Generator('cpu').manual_seed(j.get('seed', 7)), **kw).frames[0]
        export_to_video(fr, f'/kaggle/working/out/{j["name"]}.mp4', fps=16)
        log('bitti', j['name'])
    except Exception as e:
        log('HATA', j['name'], repr(e)[:400])
        pipe.maybe_free_model_hooks()  # hata modeli kartta bırakmasın, sonraki iş bellek bulsun
    gc.collect(); torch.cuda.empty_cache()
log('hepsi bitti')
'''


def kaggle(*args, capture=True):
    return subprocess.run([KAGGLE, *args], capture_output=capture, text=True)


DATASET = 'nm-wan-refs'


def refs_dataset(user, jobs):
    # referans görseller betiğe gömülünce Kaggle betiği reddediyor (boyut): gizli bir veri seti olarak yüklenir/güncellenir
    import shutil
    d = tempfile.mkdtemp()
    for f in os.listdir(OUT):  # bütün referanslar (eski sürümde olanlar da kalsın)
        if f.endswith('_ref.png'): shutil.copy(os.path.join(OUT, f), d)
    json.dump({'title': DATASET, 'id': f'{user}/{DATASET}', 'licenses': [{'name': 'CC0-1.0'}]}, open(os.path.join(d, 'dataset-metadata.json'), 'w'))
    exists = DATASET in kaggle('datasets', 'list', '--mine').stdout
    r = kaggle('datasets', 'version', '-p', d, '-m', 'refs') if exists else kaggle('datasets', 'create', '-p', d)
    print('veri seti:', (r.stdout + r.stderr).strip()[-200:], flush=True)
    for _ in range(30):  # hazır olana kadar
        if 'ready' in kaggle('datasets', 'status', f'{user}/{DATASET}').stdout.lower(): break
        time.sleep(10)


def run(jobs, slug=SLUG):
    user = [l for l in kaggle('config', 'view').stdout.splitlines() if 'username' in l][0].split(':')[1].strip()
    if '--veri-yok' not in sys.argv: refs_dataset(user, jobs)  # veri seti zaten güncelse atla
    d = tempfile.mkdtemp()
    code = KERNEL.replace('__JOBS__', base64.b64encode(json.dumps(jobs).encode()).decode())
    open(os.path.join(d, 'kernel.py'), 'w').write(code)
    json.dump({'id': f'{user}/{slug}', 'title': slug, 'code_file': 'kernel.py', 'language': 'python', 'kernel_type': 'script',
               'is_private': True, 'enable_gpu': True, 'enable_internet': True, 'machine_shape': 'NvidiaTeslaT4',
               'dataset_sources': [f'{user}/{DATASET}'], 'competition_sources': [], 'kernel_sources': []}, open(os.path.join(d, 'kernel-metadata.json'), 'w'))
    r = kaggle('kernels', 'push', '-p', d); print(r.stdout.strip(), r.stderr.strip()[-300:], flush=True)
    while True:
        time.sleep(60)
        st = kaggle('kernels', 'status', f'{user}/{slug}').stdout.strip()
        print(time.strftime('%H:%M'), st, flush=True)
        if any(w in st.lower() for w in ('complete', 'error', 'cancel')): break
    od = tempfile.mkdtemp()
    kaggle('kernels', 'output', f'{user}/{slug}', '-p', od)
    log = [f for f in os.listdir(od) if f.endswith('.log')]
    if log: print(open(os.path.join(od, log[0])).read()[-3000:])
    import fcntl, video_uret
    lock = open(os.path.join(OUT, '.isle.lock'), 'w'); fcntl.flock(lock, fcntl.LOCK_EX)  # iki oturum anim.json'u aynı anda yazmasın
    for j in jobs:
        src = os.path.join(od, 'out', j['name'] + '.mp4')
        if not os.path.exists(src): src = os.path.join(od, j['name'] + '.mp4')
        if os.path.exists(src):
            os.replace(src, os.path.join(OUT, j['name'] + '.mp4'))
            video_uret.process(j); print('şerit:', j['name'], flush=True)


if __name__ == '__main__':
    import video_uret
    meta = json.load(open(os.path.join(ROOT, 'sinir-kalesi', 'img', 'anim.json')))
    jobs = video_uret.modal_jobs(meta)
    if '--isler' in sys.argv:  # hazır iş listesi (ör. Mortimer animasyonları)
        jobs = json.load(open(sys.argv[sys.argv.index('--isler') + 1]))
    if '--dene' in sys.argv: jobs = jobs[:int(sys.argv[sys.argv.index('--dene') + 1])]
    slug = SLUG
    if '--ad' in sys.argv: slug = f"{SLUG}-{sys.argv[sys.argv.index('--ad') + 1]}"
    if '--parca' in sys.argv:  # --parca 0/2: işlerin yarısı, ayrı Kaggle oturumunda (iki oturum aynı anda çalışır)
        i, n = map(int, sys.argv[sys.argv.index('--parca') + 1].split('/'))
        jobs = jobs[i::n]; slug = f'{SLUG}-{i}'
    print(len(jobs), 'iş:', ', '.join(j['name'] for j in jobs), flush=True)
    run(jobs, slug)
