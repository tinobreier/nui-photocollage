#!/usr/bin/env python3
"""
Generate QR code markers for IDs 0-7
Requires: pip install qrcode pillow
"""

import os
import qrcode

def generate_qr_marker(marker_id, output_dir='assets/markers-qr'):
    """Generate a QR code marker for the given ID"""

    # Create QR code with marker data
    qr = qrcode.QRCode(
        version=1,  # Small QR code
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction
        box_size=10,
        border=4,
    )

    # Data format: MARKER-{id}
    data = f'MARKER-{marker_id}'
    qr.add_data(data)
    qr.make(fit=True)

    # Create image
    img = qr.make_image(fill_color="black", back_color="white")

    # Save
    os.makedirs(output_dir, exist_ok=True)
    filename = f'{output_dir}/qr_{marker_id}.png'
    img.save(filename)

    print(f'Generated: {filename} (Data: {data})')

def main():
    print("Generating QR code markers...")

    for marker_id in range(8):
        generate_qr_marker(marker_id)

    print("\nAll QR markers generated successfully!")
    print("Markers saved to: assets/markers-qr/")

if __name__ == '__main__':
    main()
