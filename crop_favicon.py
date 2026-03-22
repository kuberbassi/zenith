from PIL import Image

try:
    img = Image.open('frontend/public/icon-trans.png')
    bbox = img.getbbox()
    if bbox:
        cropped_img = img.crop(bbox)
        width, height = cropped_img.size
        # Add 15% padding for the favicon so it breathes
        pad = max(width, height) // 6
        
        # Create a new image with transparent background, sized up by padding
        new_width = width + pad * 2
        new_height = height + pad * 2
        
        # We create a new empty image, then paste the tightly cropped image into the center
        padded_img = Image.new('RGBA', (new_width, new_height), (0, 0, 0, 0))
        padded_img.paste(cropped_img, (pad, pad))
        
        # Resize to standard favicon size if it's very large
        if padded_img.width > 512:
            padded_img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        padded_img.save('frontend/public/favicon-cropped.png')
        print('Cropped successfully with 15% padding')
    else:
        print('Image is fully transparent')
except Exception as e:
    print('Failed:', str(e))
