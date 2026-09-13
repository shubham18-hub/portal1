#!/usr/bin/env python3
"""
Generate bcrypt hash for admin password.

Usage:
    python generate_admin_hash.py
    
Then enter your desired password when prompted.
The script will output the bcrypt hash to use as ADMIN_PASSWORD_HASH.
"""

import bcrypt
import getpass

def main():
    print("=== KLECBA Admin Password Hash Generator ===\n")
    
    password = getpass.getpass("Enter admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    
    if password != confirm:
        print("Error: Passwords do not match!")
        return
    
    if len(password) < 8:
        print("Warning: Password is shorter than 8 characters. Consider using a stronger password.")
    
    # Generate bcrypt hash
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    print("\n" + "="*50)
    print("Your ADMIN_PASSWORD_HASH:")
    print("="*50)
    print(hashed.decode())
    print("="*50)
    print("\nAdd this to your Render environment variables as ADMIN_PASSWORD_HASH")

if __name__ == "__main__":
    main()
