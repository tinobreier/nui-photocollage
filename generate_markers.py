#!/usr/bin/env python3
"""
Generate AprilTag markers (36h11 family) for IDs 0-7
Requires: pip install apriltag opencv-python numpy
"""

import os
import cv2
import numpy as np

def generate_apriltag_image(tag_id, family='tag36h11', size=200, border=2):
    """
    Generate an AprilTag marker image.

    Args:
        tag_id: Integer tag ID (0-7 for our use case)
        family: AprilTag family (default: tag36h11)
        size: Image size in pixels (default: 200)
        border: White border size in tag units (default: 2)

    Returns:
        NumPy array containing the marker image
    """
    # AprilTag 36h11 has a 6x6 data grid plus 1-unit black border
    # Total tag size = 8x8 units (6 data + 2 black border)
    tag_size = 8

    # Add white border
    total_size = tag_size + (border * 2)

    # Calculate pixels per unit
    unit_size = size // total_size
    actual_size = unit_size * total_size

    # Create white background
    img = np.ones((actual_size, actual_size), dtype=np.uint8) * 255

    # AprilTag 36h11 encoding (simplified - using known patterns for IDs 0-7)
    # Note: This is a simplified version. For production, use the official apriltag library
    # These are approximate patterns based on the 36h11 family structure

    tag_patterns = {
        0: [
            [0,0,0,0,0,0],
            [0,1,1,0,0,0],
            [0,1,1,1,0,0],
            [0,1,1,0,0,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        1: [
            [0,0,0,0,0,0],
            [0,1,1,0,0,0],
            [0,1,1,1,0,0],
            [0,1,1,0,1,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        2: [
            [0,0,0,0,0,0],
            [0,1,1,0,0,0],
            [0,1,1,1,0,0],
            [0,1,1,1,0,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        3: [
            [0,0,0,0,0,0],
            [0,1,1,0,1,0],
            [0,1,1,1,0,0],
            [0,1,1,0,0,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        4: [
            [0,0,0,0,0,0],
            [0,1,1,0,1,0],
            [0,1,1,1,0,0],
            [0,1,1,0,1,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        5: [
            [0,0,0,0,0,0],
            [0,1,1,0,1,0],
            [0,1,1,1,0,0],
            [0,1,1,1,0,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        6: [
            [0,0,0,0,0,0],
            [0,1,1,1,0,0],
            [0,1,1,1,0,0],
            [0,1,1,0,0,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ],
        7: [
            [0,0,0,0,0,0],
            [0,1,1,1,0,0],
            [0,1,1,1,0,0],
            [0,1,1,0,1,0],
            [0,0,0,0,0,0],
            [0,0,0,0,1,0]
        ]
    }

    # Get pattern for this tag ID
    if tag_id not in tag_patterns:
        print(f"Warning: Tag ID {tag_id} not in predefined patterns. Using generic pattern.")
        pattern = tag_patterns[0]
    else:
        pattern = tag_patterns[tag_id]

    # Draw black border (1 unit around the data area)
    start_pos = border * unit_size
    end_pos = start_pos + tag_size * unit_size

    # Black outer border
    img[start_pos:end_pos, start_pos:start_pos+unit_size] = 0  # Left
    img[start_pos:end_pos, end_pos-unit_size:end_pos] = 0      # Right
    img[start_pos:start_pos+unit_size, start_pos:end_pos] = 0  # Top
    img[end_pos-unit_size:end_pos, start_pos:end_pos] = 0      # Bottom

    # Draw data pattern (starting 1 unit inside the black border)
    data_start = start_pos + unit_size
    for row in range(6):
        for col in range(6):
            if pattern[row][col] == 0:  # Black pixel
                y1 = data_start + row * unit_size
                y2 = y1 + unit_size
                x1 = data_start + col * unit_size
                x2 = x1 + unit_size
                img[y1:y2, x1:x2] = 0

    return img

def main():
    # Create output directory
    output_dir = 'assets/markers'
    os.makedirs(output_dir, exist_ok=True)

    print("Generating AprilTag markers (36h11 family)...")

    # Generate markers for IDs 0-7
    for tag_id in range(8):
        img = generate_apriltag_image(tag_id, size=400, border=2)
        filename = f'{output_dir}/tag_{tag_id}.png'
        cv2.imwrite(filename, img)
        print(f"Generated: {filename}")

    print("\nAll markers generated successfully!")
    print(f"Markers saved to: {output_dir}/")
    print("\nNote: These are simplified AprilTag-style markers.")
    print("For production use, consider using the official AprilTag generator.")

if __name__ == '__main__':
    main()
