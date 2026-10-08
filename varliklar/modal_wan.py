"""Wan 2.2 (14B, görselden video) Modal'da: düşman ve iskelet animasyon videoları (aylık 30 $ ücretsiz kredi).

    <venv>/bin/modal run varliklar/modal_wan.py --jobs varliklar/ham/anim/isler.json

isler.json: [{"name": "gladiator_yuru", "ref": "ham/anim/gladiator_ref.png", "prompt": "...", "frames": 33, "loop": true}, ...]
  loop: son kare = ilk kare (dikişsiz döngü). frames 4k+1 olmalı (33, 49...).
Çıktı: varliklar/ham/anim/<name>.mp4. Sonra video_isle.py şeride çevirir (video_uret.py --modal bunu toplu yapar).
Ayarlar Hugging Face'teki zerogpu-aoti/wan2-2-fp8da-aoti-faster alanıyla aynı (Lightx2v hızlandırma, 6 adım, 16 kare/sn).
Model ağırlıkları "wan-cache" Modal diskinde tutulur (ilk çalıştırmada bir kez iner).
"""
import io, json, os
import modal

app = modal.App('nm-wan')
cache = modal.Volume.from_name('wan-cache', create_if_missing=True)
image = (modal.Image.debian_slim(python_version='3.11')
         .apt_install('ffmpeg')
         .pip_install('torch', 'diffusers>=0.35.1', 'transformers', 'accelerate', 'peft', 'ftfy', 'sentencepiece',
                      'safetensors', 'imageio', 'imageio-ffmpeg', 'huggingface_hub[hf_transfer]', 'pillow', 'numpy')
         .env({'HF_HOME': '/cache', 'HF_HUB_ENABLE_HF_TRANSFER': '1'}))

NEG = ('色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 画面, 静止, 整体发灰, 最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, '
       '多余的手指, 画得不好的手部, 画得不好的脸部, 畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走')


@app.cls(gpu='H200', image=image, volumes={'/cache': cache}, timeout=3600, scaledown_window=60, max_containers=4)
class Wan:
    @modal.enter()
    def load(self):
        import torch
        from diffusers.pipelines.wan.pipeline_wan_i2v import WanImageToVideoPipeline
        from diffusers.models.transformers.transformer_wan import WanTransformer3DModel
        tr = lambda sub: WanTransformer3DModel.from_pretrained('cbensimon/Wan2.2-I2V-A14B-bf16-Diffusers', subfolder=sub, torch_dtype=torch.bfloat16)
        pipe = WanImageToVideoPipeline.from_pretrained('Wan-AI/Wan2.2-I2V-A14B-Diffusers', transformer=tr('transformer'),
                                                       transformer_2=tr('transformer_2'), torch_dtype=torch.bfloat16)
        lora = dict(weight_name='Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank128_bf16.safetensors')
        pipe.load_lora_weights('Kijai/WanVideo_comfy', adapter_name='lightx2v', **lora)
        pipe.load_lora_weights('Kijai/WanVideo_comfy', adapter_name='lightx2v_2', load_into_transformer_2=True, **lora)
        pipe.set_adapters(['lightx2v', 'lightx2v_2'], adapter_weights=[1., 1.])
        pipe.fuse_lora(adapter_names=['lightx2v'], lora_scale=3., components=['transformer'])
        pipe.fuse_lora(adapter_names=['lightx2v_2'], lora_scale=1., components=['transformer_2'])
        pipe.unload_lora_weights()
        self.pipe = pipe.to('cuda')
        cache.commit()

    @modal.method()
    def gen(self, png: bytes, prompt: str, frames: int = 49, loop: bool = False, seed: int = 7) -> bytes:
        import tempfile, torch
        from PIL import Image
        from diffusers.utils.export_utils import export_to_video
        im = Image.open(io.BytesIO(png)).convert('RGB').resize((832, 480))
        kw = dict(last_image=im) if loop else {}
        out = self.pipe(image=im, prompt=prompt, negative_prompt=NEG, height=480, width=832, num_frames=frames,
                        guidance_scale=1.0, guidance_scale_2=1.0, num_inference_steps=6,
                        generator=torch.Generator(device='cuda').manual_seed(seed), **kw).frames[0]
        p = tempfile.mktemp(suffix='.mp4')
        export_to_video(out, p, fps=16)
        return open(p, 'rb').read()


@app.local_entrypoint()
def main(jobs: str):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    J = json.load(open(os.path.join(root, jobs) if not os.path.isabs(jobs) else jobs))
    wan = Wan()
    args = [(open(os.path.join(root, 'varliklar', j['ref']), 'rb').read(), j['prompt'], j.get('frames', 49), j.get('loop', False), j.get('seed', 7)) for j in J]
    for j, mp4 in zip(J, wan.gen.starmap(args, order_outputs=True)):
        p = os.path.join(root, 'varliklar', 'ham', 'anim', j['name'] + '.mp4')
        open(p, 'wb').write(mp4)
        print('yazıldı', p, len(mp4) // 1024, 'KB', flush=True)
