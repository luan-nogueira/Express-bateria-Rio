"""
Gera as imagens otimizadas do site a partir de assets-originais/.

Uso:  python scripts/build-images.py   (requer Pillow)

Saída em public/img/ e public/ (favicons e imagem de compartilhamento).
As fotos são reais, publicadas pela própria Express Baterias Rio.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-originais"
OUT = ROOT / "public" / "img"
PUBLIC = ROOT / "public"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = (24, 46, 137)
YELLOW = (255, 185, 0)
INK = (10, 12, 20)

PHOTOS = {
    "loja-interior": "1-express-baterias-loja-zona-sul-baterias-automotivas.jpg",
    "loja-fachada": "2-express-baterias-loja-zona-sul-baterias-para-moto-baterias-para-carro.jpg",
    "instalacao-ford": "3-express-baterias-loja-zona-sul-baterias-para-moto-baterias-para-carro-1-scaled.jpg",
    "instalacao-jeep": "4-express-baterias-loja-zona-sul-baterias-para-moto-baterias-para-carro-1-scaled.jpg",
}
WIDTHS = (480, 800, 1200)


def save_variants(img: Image.Image, name: str) -> None:
    for w in WIDTHS:
        if w > img.width:
            continue
        h = round(img.height * w / img.width)
        im = img.resize((w, h), Image.LANCZOS)
        im.save(OUT / f"{name}-{w}.webp", "WEBP", quality=76, method=6)
        im.save(OUT / f"{name}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        print(f"  {name}-{w}  {w}x{h}")


def photos() -> None:
    for name, file in PHOTOS.items():
        img = Image.open(SRC / file).convert("RGB")
        # Todas as fotos originais são 3:4; normaliza a proporção exata.
        target_h = round(img.width * 4 / 3)
        if img.height != target_h:
            top = (img.height - target_h) // 2
            img = img.crop((0, max(top, 0), img.width, max(top, 0) + target_h))
        save_variants(img, name)


def logo() -> Image.Image:
    lg = Image.open(SRC / "logo.png").convert("RGBA")
    bbox = lg.getbbox()
    lg = lg.crop(bbox)
    lg.save(OUT / "logo.png", optimize=True)
    small = lg.resize((480, round(lg.height * 480 / lg.width)), Image.LANCZOS)
    small.save(OUT / "logo-480.png", optimize=True)
    small.save(OUT / "logo-480.webp", "WEBP", quality=90, method=6)
    print("  logo", lg.size, "->", small.size)
    return lg


def favicons(lg: Image.Image) -> None:
    # A marca (bateria + raio) ocupa o primeiro ~38% da largura do logotipo.
    mark = lg.crop((0, 0, round(lg.width * 0.395), lg.height))
    mark = mark.crop(mark.getbbox())
    for size, fname, pad, bg in (
        (512, "icon-512.png", 0.14, INK),
        (192, "icon-192.png", 0.14, INK),
        (180, "apple-touch-icon.png", 0.16, INK),
        (48, "favicon-48.png", 0.06, None),
        (32, "favicon-32.png", 0.04, None),
    ):
        canvas = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
        inner = round(size * (1 - 2 * pad))
        m = mark.copy()
        m.thumbnail((inner, inner), Image.LANCZOS)
        canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
        canvas.save(PUBLIC / fname, optimize=True)
    ico = Image.open(PUBLIC / "favicon-48.png")
    ico.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  favicons ok")


def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{n}", size)
        except OSError:
            continue
    return ImageFont.load_default()


def og_image(lg: Image.Image) -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), INK)
    # Luz suave em azul institucional atrás da foto.
    glow = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(glow)
    d.ellipse((620, -120, 1380, 700), fill=(20, 34, 96))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img.paste(glow)
    photo = Image.open(SRC / PHOTOS["instalacao-jeep"]).convert("RGB")
    ph_w = 540
    photo = photo.resize((ph_w, round(photo.height * ph_w / photo.width)), Image.LANCZOS)
    top = (photo.height - H) // 2
    photo = photo.crop((0, top, ph_w, top + H))
    # Degradê horizontal para fundir a foto ao fundo, sem emenda visível.
    fade = Image.new("L", (ph_w, H))
    fd = ImageDraw.Draw(fade)
    for x in range(ph_w):
        t = min(1.0, x / 260)
        fd.line([(x, 0), (x, H)], fill=int(255 * t * t * (3 - 2 * t)))
    img.paste(photo, (W - ph_w, 0), fade)

    logo_w = 330
    lgs = lg.resize((logo_w, round(lg.height * logo_w / lg.width)), Image.LANCZOS)
    img.paste(lgs, (72, 64), lgs)

    d = ImageDraw.Draw(img)
    eyebrow = font(["seguisb.ttf", "arialbd.ttf"], 22)
    title = font(["seguibl.ttf", "ariblk.ttf", "arialbd.ttf"], 58)
    body = font(["segoeui.ttf", "arial.ttf"], 26)
    d.rectangle((72, 262, 80, 288), fill=YELLOW)
    d.text((94, 260), "ATENDIMENTO 24 HORAS · RIO DE JANEIRO", font=eyebrow, fill=YELLOW)
    d.text((72, 306), "Seu carro não pode parar.", font=title, fill=(255, 255, 255))
    d.text((72, 374), "Sua energia também não.", font=title, fill=(255, 255, 255))
    d.text((72, 470), "Baterias automotivas com entrega e instalação.", font=body, fill=(200, 205, 222))
    d.text((72, 506), "(21) 99940-4005 · Botafogo, Rio de Janeiro", font=body, fill=(200, 205, 222))
    img.save(PUBLIC / "og-image.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    print("  og-image ok")


if __name__ == "__main__":
    print("Fotos:")
    photos()
    print("Logo:")
    lg = logo()
    favicons(lg)
    og_image(lg)
