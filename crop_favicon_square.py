from PIL import Image

try:
    img = Image.open('frontend/public/icon-trans.png')
    bbox = img.getbbox()
    if bbox:
        # Calculate width and height of the tight bounding box
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        
        # We need a perfect square. Make the crop area a square based on the max dimension.
        max_dim = max(bw, bh)
        
        # Center the bounding box within this perfect square
        center_x = (bbox[0] + bbox[2]) // 2
        center_y = (bbox[1] + bbox[3]) // 2
        
        half = max_dim // 2
        square_bbox = (
            center_x - half,
            center_y - half,
            center_x + half,
            center_y + half
        )
        
        # Crop the square box (it may go out of bounds of the original image, which pads with transparency)
        cropped_img = img.crop(square_bbox)
        
        # Add 20% padding around the square
        pad = max_dim // 5
        new_dim = max_dim + pad * 2
        
        padded_img = Image.new('RGBA', (new_dim, new_dim), (0, 0, 0, 0))
        padded_img.paste(cropped_img, (pad, pad))
        
        # Resize to 512x512, which is standard for PWA
        padded_img = padded_img.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Save primary favicon/PWA icon
        padded_img.save('frontend/public/favicon-cropped.png')
        
        # Create a 192x192 version for PWA
        img192 = padded_img.resize((192, 192), Image.Resampling.LANCZOS)
        img192.save('frontend/public/pwa-192x192.png')
        
        # Create a 512x512 version
        padded_img.save('frontend/public/pwa-512x512.png')
        
        print('Cropped successfully to perfect square with icons generated')
    else:
        print('Image is fully transparent')
except Exception as e:
    print('Failed:', str(e))
