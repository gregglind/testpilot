import hashlib
import sys

if len(sys.argv) != 2:
    print "Usage: python signer.py filename"

filename = sys.argv[1]
file = open(filename, "rb")
goodies = file.read()
file.close()

hash = hashlib.sha256(goodies).hexdigest()

print "SHA256 Hash of %s is %s" % (filename, hash)
