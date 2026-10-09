"""Yeni düşman/sahne görsellerini Kaggle'ın ücretsiz ekran kartında FLUX.1 Kontext ile çizer (referans görselin tarzında).

    <venv>/bin/python varliklar/kaggle_kontext.py varliklar/ham/yeni/isler.json

isler.json: [{"name": "war_dog", "ref": "kontext_legion_ref.png", "prompt": "...", "seeds": [11, 23]}, ...]
  ref: varliklar/ham/anim/ içindeki *_ref.png (Kaggle veri setine yüklenir).
Çıktı: varliklar/ham/yeni/<name>_<seed>.png (magenta zeminli; nm_isle/anim araçlarıyla işlenir).
Model: QuantStack/FLUX.1-Kontext-dev-GGUF (Q4_K_M) + ostris/Flex.1-alpha'nın VAE/metin kodlayıcıları (Apache-2.0, hesapsız iner).
Kontext çıktıları ticari kullanılabilir (FLUX.1 [dev] lisansı: çıktılar kullanıcıya ait; rakip model eğitmek yasak).
"""
import base64, json, os, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kaggle_wan as K

ROOT = K.ROOT
OUT = os.path.join(ROOT, 'varliklar', 'ham', 'yeni')
SLUG = 'nm-kontext'

KERNEL = r'''
import json, os, subprocess, sys, time, glob, base64, gc
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers', 'transformers', 'accelerate', 'gguf', 'sentencepiece', 'protobuf', 'hf_transfer'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])
os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'
import torch
from PIL import Image
from huggingface_hub import hf_hub_download
from diffusers import FluxKontextPipeline, FluxTransformer2DModel, GGUFQuantizationConfig, FlowMatchEulerDiscreteScheduler, AutoencoderKL
from transformers import CLIPTextModel, CLIPTokenizer, T5EncoderModel, T5TokenizerFast
JOBS = json.loads(base64.b64decode('__JOBS__'))
REFS = os.path.dirname(glob.glob('/kaggle/input/**/*_ref.png', recursive=True)[0])
os.makedirs('/kaggle/working/out', exist_ok=True)
t0 = time.time(); log = lambda *a: print(f'[{time.time() - t0:6.0f}s]', *a, flush=True)
R = 'ostris/Flex.1-alpha'  # Apache-2.0: FLUX'un VAE ve metin kodlayıcılarıyla aynı, hesapsız iner
sch = FlowMatchEulerDiscreteScheduler(base_image_seq_len=256, base_shift=0.5, max_image_seq_len=4096, max_shift=1.15, num_train_timesteps=1000, shift=3.0, use_dynamic_shifting=True)
# 1) istemler: fp16 kodlayıcılarla bir kez (T5'in hassas katmanları fp32 kalır), sonra bellekten atılır
te = CLIPTextModel.from_pretrained(R, subfolder='text_encoder', torch_dtype=torch.float16).to('cuda')
te2 = T5EncoderModel.from_pretrained(R, subfolder='text_encoder_2', torch_dtype=torch.float16).to('cuda')
ep = FluxKontextPipeline(scheduler=sch, vae=None, text_encoder=te, tokenizer=CLIPTokenizer.from_pretrained(R, subfolder='tokenizer'),
                         text_encoder_2=te2, tokenizer_2=T5TokenizerFast.from_pretrained(R, subfolder='tokenizer_2'), transformer=None)
EMB = []
with torch.no_grad():
    for j in JOBS:
        pe, ppe, _ = ep.encode_prompt(prompt=j['prompt'], prompt_2=None, device='cuda', max_sequence_length=512)
        log('istem', j['name'], 'nan' if torch.isnan(pe).any() or torch.isnan(ppe).any() else 'ok')
        EMB.append((pe.float().cpu(), ppe.float().cpu()))
del ep, te, te2; gc.collect(); torch.cuda.empty_cache()
# 2) çizim: GGUF dönüştürücü fp32 hesaplar (T4'te fp16 taşıp siyah resim veriyordu), VAE fp32
cfg = '/kaggle/working/fluxcfg'; os.makedirs(cfg, exist_ok=True)
json.dump({'_class_name': 'FluxTransformer2DModel', 'attention_head_dim': 128, 'guidance_embeds': True, 'in_channels': 64, 'joint_attention_dim': 4096,
           'num_attention_heads': 24, 'num_layers': 19, 'num_single_layers': 38, 'patch_size': 1, 'pooled_projection_dim': 768}, open(cfg + '/config.json', 'w'))
p = hf_hub_download('QuantStack/FLUX.1-Kontext-dev-GGUF', 'flux1-kontext-dev-Q4_K_M.gguf')
tr = FluxTransformer2DModel.from_single_file(p, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.float32), config=cfg, torch_dtype=torch.float32)
vae = AutoencoderKL.from_pretrained(R, subfolder='vae', torch_dtype=torch.float32)
pipe = FluxKontextPipeline(scheduler=sch, vae=vae, text_encoder=None, tokenizer=None, text_encoder_2=None, tokenizer_2=None, transformer=tr).to('cuda')
log('model hazır')
for j, (pe, ppe) in zip(JOBS, EMB):
    S = j.get('size', 768)
    im = Image.open(os.path.join(REFS, os.path.basename(j['ref']))).convert('RGB').resize((S, S))
    for sd in j.get('seeds', [11]):
        try:
            with torch.no_grad():
                out = pipe(image=im, prompt_embeds=pe.to('cuda'), pooled_prompt_embeds=ppe.to('cuda'), guidance_scale=2.5, num_inference_steps=j.get('steps', 20),
                           height=S, width=S, _auto_resize=False, generator=torch.Generator('cpu').manual_seed(sd)).images[0]
            out.save(f'/kaggle/working/out/{j["name"]}_{sd}.png'); log('bitti', j['name'], sd, out.getextrema())
        except Exception as e:
            log('HATA', j['name'], repr(e)[:400])
        gc.collect(); torch.cuda.empty_cache()
log('hepsi bitti')
'''


def run(jobs, slug=SLUG):
    user = [l for l in K.kaggle('config', 'view').stdout.splitlines() if 'username' in l][0].split(':')[1].strip()
    if '--veri-yok' not in sys.argv: K.refs_dataset(user, jobs)
    d = tempfile.mkdtemp()
    open(os.path.join(d, 'kernel.py'), 'w').write(KERNEL.replace('__JOBS__', base64.b64encode(json.dumps(jobs).encode()).decode()))
    json.dump({'id': f'{user}/{slug}', 'title': slug, 'code_file': 'kernel.py', 'language': 'python', 'kernel_type': 'script',
               'is_private': True, 'enable_gpu': True, 'enable_internet': True, 'machine_shape': 'NvidiaTeslaT4',
               'dataset_sources': [f'{user}/{K.DATASET}'], 'competition_sources': [], 'kernel_sources': []}, open(os.path.join(d, 'kernel-metadata.json'), 'w'))
    for _ in range(240):  # aynı anda 2 GPU oturumu sınırı: boşalana kadar dakikada bir dene
        r = K.kaggle('kernels', 'push', '-p', d); out = (r.stdout + r.stderr).strip()
        print(out[-300:], flush=True)
        if 'successfully pushed' in out: break
        time.sleep(60)
    else: raise SystemExit('gönderilemedi')
    while True:
        time.sleep(60)
        st = K.kaggle('kernels', 'status', f'{user}/{slug}').stdout.strip()
        print(time.strftime('%H:%M'), st, flush=True)
        if any(w in st.lower() for w in ('complete', 'error', 'cancel')): break
    od = tempfile.mkdtemp()
    K.kaggle('kernels', 'output', f'{user}/{slug}', '-p', od)
    lg = [f for f in os.listdir(od) if f.endswith('.log')]
    if lg: print(open(os.path.join(od, lg[0])).read()[-3000:])
    os.makedirs(OUT, exist_ok=True)
    for f in glob_png(od):
        os.replace(f, os.path.join(OUT, os.path.basename(f))); print('görsel:', os.path.basename(f), flush=True)


def glob_png(d):
    import glob
    return glob.glob(os.path.join(d, '**', '*.png'), recursive=True)


if __name__ == '__main__':
    run(json.load(open(sys.argv[1])))
