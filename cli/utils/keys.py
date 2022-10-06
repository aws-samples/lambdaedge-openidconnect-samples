from cryptography.hazmat.backends import default_backend  
from cryptography.hazmat.primitives import serialization  
from cryptography.hazmat.primitives.asymmetric import rsa  
  

def generate_keys():
    """
    Generates openssl public and private key pairs.

    Returns:
        key_pair_map (dict) = a dict with both the public and private keys.
    """
    key_pair_map = {}
    # generate private key & write to disk  
    private_key = rsa.generate_private_key(  
        public_exponent=65537,  
        key_size=4096,  
        backend=default_backend()  
    )  
    pem = private_key.private_bytes(  
        encoding=serialization.Encoding.PEM,  
        format=serialization.PrivateFormat.PKCS8,  
        encryption_algorithm=serialization.NoEncryption()  
    )
    key_pair_map['PRIVATE_KEY'] = pem.decode('utf-8')

     # generate public key  
    public_key = private_key.public_key()  
    pem = public_key.public_bytes(  
        encoding=serialization.Encoding.PEM,  
        format=serialization.PublicFormat.SubjectPublicKeyInfo  
    )
    key_pair_map['PUBLIC_KEY'] = pem.decode('utf-8')

    return key_pair_map
