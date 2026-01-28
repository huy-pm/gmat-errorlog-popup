from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create image with black background
    img = Image.new('RGB', (size, size), color='#1a1a1a')
    draw = ImageDraw.Draw(img)
    
    # Calculate font size (35% of image size)
    font_size = int(size * 0.35)
    
    # Try to use a bold font, fallback to default
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw text
    text = "GMAT"
    
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]
    
    # Draw white text
    draw.text((x, y), text, fill='white', font=font)
    
    # Save
    img.save(filename, 'PNG')
    print(f"Created {filename}")

# Generate all three sizes
create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')

print("\nIcons created successfully!")
