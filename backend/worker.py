"""Free image processing. Neural background removal, classical photo enhancement."""
import os
import json
import sys
import warnings
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
MAX_INPUT_PIXELS = int(os.getenv('MAX_INPUT_PIXELS', '20000000'))
MAX_OUTPUT_PIXELS = int(os.getenv('MAX_OUTPUT_PIXELS', '40000000'))
Image.MAX_IMAGE_PIXELS = max(MAX_INPUT_PIXELS, MAX_OUTPUT_PIXELS)
warnings.simplefilter('error', Image.DecompressionBombWarning)


def process(source, destination, settings):
    mode = settings['mode']
    input_limit = MAX_OUTPUT_PIXELS if mode == 'normalize' else MAX_INPUT_PIXELS
    with Image.open(source) as opened:
        if mode != 'normalize' and (opened.format not in ('JPEG', 'PNG', 'WEBP') or getattr(opened, 'n_frames', 1) != 1):
            raise ValueError('Choose a still JPEG, PNG or WebP image.')
        if opened.width * opened.height > input_limit:
            raise ValueError('Image exceeds the input pixel limit. Choose a smaller photo.')
        image = ImageOps.exif_transpose(opened).convert('RGBA')
    if mode == 'validate':
        return {'width': image.width, 'height': image.height}
    scale = settings.get('scale', 2) if mode == 'hd_upscale' else 1
    if image.width * image.height * scale * scale > MAX_OUTPUT_PIXELS:
        raise ValueError('Output exceeds the pixel limit. Choose 2x or a smaller image.')
    if mode == 'remove_bg':
        from rembg import new_session, remove
        image = remove(image, session=new_session('u2netp'))
    elif mode not in ('normalize', 'sanitize'):
        alpha = image.getchannel('A')
        rgb = image.convert('RGB')
        strength = settings.get('strength', 80) / 100
        if mode in ('auto', 'photo_restore', 'face_enhance') and settings.get('noiseReduction', 60):
            pixels = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
            h = settings.get('noiseReduction', 60) / 10
            pixels = cv2.fastNlMeansDenoisingColored(pixels, None, h, h, 7, 21)
            rgb = Image.fromarray(cv2.cvtColor(pixels, cv2.COLOR_BGR2RGB))
        if mode in ('auto', 'photo_restore', 'color_enhance'):
            rgb = Image.blend(rgb, ImageOps.autocontrast(rgb, cutoff=1), strength)
            rgb = ImageEnhance.Color(rgb).enhance(1 + settings.get('colorEnhancement', 75) / 250)
            rgb = ImageEnhance.Contrast(rgb).enhance(1 + strength * 0.12)
        if mode in ('auto', 'face_enhance', 'photo_restore', 'sharpen', 'hd_upscale'):
            amount = round(settings.get('sharpening', 70) * strength * 2)
            if mode == 'face_enhance':
                amount = round(settings.get('faceEnhanceStrength', 85) * strength * 2)
            rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.5, percent=amount, threshold=3))
        image = rgb.convert('RGBA')
        image.putalpha(alpha)
        if scale > 1:
            image = image.resize((image.width * scale, image.height * scale), Image.Resampling.LANCZOS)
    image.info.clear()  # Do not copy EXIF/location metadata into the result.
    image.save(destination, format='PNG', optimize=True)
    return {'width': image.width, 'height': image.height, 'fileSize': Path(destination).stat().st_size, 'mimeType': 'image/png'}


if __name__ == '__main__':
    try:
        print(json.dumps(process(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))))
    except Exception as error:
        print(f'Unable to process image: {error}', file=sys.stderr)
        sys.exit(1)
