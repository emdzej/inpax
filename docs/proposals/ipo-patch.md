# IPO Patches

Idea is to be able to create a patch file that can be applied to .ipo file (mostly for translation purposes)
The patch file should be human readable (yaml? json?)
What we can patch is the constant values in constant section in ipo file

Patch files shouud be encoded in utf8 unless instructed otherwise

Patch files should contain:
- iformation the original file:
    - name
    - checksum of the original unmodified file
    - location (not full path, but belonging e.g. inpa, nfs, ncsexpert)
- description of the patch, what it does
- patch list, each item contains:
    - const index
    - const type
    - new value
    - notes: i'd put here the usage information of the constant, for exampel fragments of disassembly, this is optional


When editing ipo with ipo-edit we can save all the changes as patch

Also new sumbommand patch needs to be introduced

all patch commands need to allow for the input and output text encodign definition (ipo are default in cp1252, patches are in utf8)

pach init - creates new patch file from all the constants, filter by data type (only strings by default), optionally include the usage infomration

patch / patch apply - takes patch and applies it to ipo file (--dry-run option as well) 
This process needs to verify the checksum of original file, and when applying patches, data types must match
We can ignore wrong checksum by passing option to the submcommadn, we can't ignore data type

When applying multiple patches to the same ipo file, checsum is calcualted first and then verify each patch's checksum expectation
