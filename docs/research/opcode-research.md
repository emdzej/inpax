=== Globals @ 0x00a5 ===
[0 : 0000] type=void (0x00)

=== Constants @ 0x00bc ===
[0 : 0000] offset=0x00d4 type=int (0x03) value=1
[1 : 0001] offset=0x00d7 type=int (0x03) value=2

=== Function: [2] inpainit (offset 0x0010, size 9) ===
    int a = 1;
    int b = 2;
    int c;
    c = a + b;
0x0023: 01 01 00 00 ; load const from slot 0 to frame
0x0027: 01 01 01 00 ; load const from slot 1 to frame
0x002b: 08 51 00 00 ; init local variable int
0x002f: 01 02 00 00 ; push for op in frame
0x0033: 01 02 01 00 ; push for op in frame
0x0037: 09 60 00 00 ; add
0x003b: 06 02 02 00 ; address for store ?
0x003f: 05 00 01 00 ; store
0x0043: 0e 00 00 00 ; return

---

=== Constants @ 0x00d4 ===
[0 : 0000] offset=0x00ec type=int (0x03) value=1
[1 : 0001] offset=0x00ef type=int (0x03) value=2

inpainit()
{
    int a = 1;
    int b = 2;
    int c;
    int d;
    c = a + b;
    d = a + c;
}

=== Function: [2] inpainit (offset 0x0010, size 15) ===

0x0023: 01 01 00 00 ; load cosnt @ 0 onto stack
0x0027: 01 01 01 00 ; load const @ 1 onsto stack
0x002b: 08 51 00 00 ; init local int @ 0
0x002f: 08 51 00 00 ; init local int @ 1
0x0033: 01 02 00 00 ; load local from stack
0x0037: 01 02 01 00 ; load local from stack
0x003b: 09 60 00 00 ; add
0x003f: 06 02 02 00 ;  addre for stor
0x0043: 05 00 01 00 ; store
0x0047: 01 02 00 00 ; push for
0x004b: 01 02 02 00 ; push
0x004f: 09 60 00 00 ; add
0x0053: 06 02 03 00 ; addr for store
0x0057: 05 00 01 00 ; store
0x005b: 0e 00 00 00

--- 

=== Constants @ 0x00e0 ===
[0 : 0000] offset=0x00f8 type=int (0x03) value=1
[1 : 0001] offset=0x00fb type=int (0x03) value=2
[2 : 0002] offset=0x00fe type=int (0x03) value=1

=== Function: [2] inpainit (offset 0x0010, size 18) ===
    int a = 1;
    int b = 2;
    int c;
    int d;
    c = a + b;
    d = a + c;
    d = 1;
0x0023: 01 01 00 00
0x0027: 01 01 01 00
0x002b: 08 51 00 00
0x002f: 08 51 00 00
0x0033: 01 02 00 00
0x0037: 01 02 01 00
0x003b: 09 60 00 00
0x003f: 06 02 02 00
0x0043: 05 00 01 00
0x0047: 01 02 00 00
0x004b: 01 02 02 00
0x004f: 09 60 00 00
0x0053: 06 02 03 00
0x0057: 05 00 01 00
0x005b: 01 01 02 00
0x005f: 06 02 03 00
0x0063: 05 00 01 00
0x0067: 0e 00 00 00

--- 

=== Globals @ 0x00d9 ===
[0 : 0000] type=void (0x00)
[1 : 0001] type=long (0x04)
[2 : 0002] type=long (0x04)

=== Constants @ 0x00f2 ===
[0 : 0000] offset=0x010a type=long (0x04) value=1
[1 : 0001] offset=0x010f type=long (0x04) value=2
[2 : 0002] offset=0x0114 type=long (0x04) value=1

=== Function: [2] inpainit (offset 0x0010, size 16) ===
long a = 1;
long b = 2;
inpainit()
{
   long c;
    long d;
    c = a + b;
    d = a + c;
    d = 1;
}

inpaexit()
{
}

0x0023: 08 53 00 00
0x0027: 08 53 00 00
0x002b: 01 00 01 00 ; load glob 1
0x002f: 01 00 02 00 l load glob 2
0x0033: 09 60 00 00 add
0x0037: 06 02 00 00
0x003b: 05 00 01 00 store
0x003f: 01 00 01 00 ; load glob
0x0043: 01 02 00 00 ; load local
0x0047: 09 60 00 00 add
0x004b: 06 02 01 00
0x004f: 05 00 01 00
0x0053: 01 01 02 00 load const
0x0057: 06 02 01 00 store local
0x005b: 05 00 01 00 stire
0x005f: 0e 00 00 00

--- 
=== Globals @ 0x00a1 ===
[0 : 0000] type=void (0x00)
[1 : 0001] type=long (0x04)

=== Constants @ 0x00b9 ===
[0 : 0000] offset=0x00d1 type=long (0x04) value=1
[1 : 0001] offset=0x00d6 type=long (0x04) value=2

=== Function: [2] inpainit (offset 0x0010, size 8) ===
long a;

inpainit()
{
   long b;
    a = 1;
    b = 2;
}

0x0023: 08 53 00 00 init local
0x0027: 01 01 00 00 load cosnt
0x002b: 06 00 01 00 store global
0x002f: 05 00 01 00 assign
0x0033: 01 01 01 00 load const
0x0037: 06 02 00 00 store local
0x003b: 05 00 01 00 assign
0x003f: 0e 00 00 00

--- 


int a;

=== Globals @ 0x00df ===
[0 : 0000] type=void (0x00)
[1 : 0001] type=int (0x03)

=== Constants @ 0x00f7 ===
[0 : 0000] offset=0x010f type=int (0x03) value=1
[1 : 0001] offset=0x0112 type=int (0x03) value=2

add(in: int a, in: int b, out: int c) {
    c = a + b;
}

=== Function: [4] add (offset 0x0010, size 6) ===
0x001e: 01 02 00 00 ; load local from stack
0x0022: 01 02 01 00 ; loac local from stack
0x0026: 09 60 00 00 ; add
0x002a: 07 02 02 00
0x002e: 05 00 01 00
0x0032: 0e 00 00 00

inpainit()
{
   int b;
    int c;
    a = 1;
    b = 2;
    add(a, b, c);
}

=== Function: [2] inpainit (offset 0x0036, size 14) ===
0x0049: 08 51 00 00 ; init local int
0x004d: 08 51 00 00 ; init local int
0x0051: 01 01 00 00 ; ;
0x0055: 06 00 01 00
0x0059: 05 00 01 00
0x005d: 01 01 01 00
0x0061: 06 02 00 00
0x0065: 05 00 01 00
0x0069: 0f 00 00 00 ; push frame?
0x006d: 01 00 01 00
0x0071: 01 02 00 00
0x0075: 02 02 01 00 push
0x0079: 0c 80 04 00 ; call
0x007d: 0e 00 00 00 ; return

---

=== Constants @ 0x00bc ===
[0 : 0000] offset=0x00d4 type=int (0x03) value=1
[1 : 0001] offset=0x00d7 type=int (0x03) value=2

inpainit()
{
    int a;
    int b;
    a = 1;
    b = 2;
}

=== Function: [2] inpainit (offset 0x0010, size 9) ===
0x0023: 08 51 00 00 ; allocate int in frame
0x0027: 08 51 00 00 ; allocate int in frame
0x002b: 01 01 00 00 ; push load const reference to stack
0x002f: 06 02 00 00 ; push store local reference to stack
0x0033: 05 00 01 00 ; copy
0x0037: 01 01 01 00 ; push const reference to stack
0x003b: 06 02 01 00 ; push local reference to stack
0x003f: 05 00 01 00 ; store
0x0043: 0e 00 00 00

---

=== Globals @ 0x009d ===
[0 : 0000] type=void (0x00)
[1 : 0001] type=int (0x03)
[2 : 0002] type=int (0x03)

=== Constants @ 0x00b6 ===
[0 : 0000] offset=0x00ce type=int (0x03) value=1
[1 : 0001] offset=0x00d1 type=int (0x03) value=2

int a;
int b;

inpainit()
{
    a = 1;
    b = 2;
}

=== Function: [2] inpainit (offset 0x0010, size 7) ===
0x0023: 01 01 00 00 push const ref
0x0027: 06 00 01 00 push glob ref
0x002b: 05 00 01 00 store
0x002f: 01 01 01 00 push const ref
0x0033: 06 00 02 00 push glob ref
0x0037: 05 00 01 00 store
0x003b: 0e 00 00 00


---

import32 "c" lib "kernel32::GetPrivateProfileStringA"  GetIniString(in: string Section, in: string Key, in: string Default,
                 out: string Buffer, in: int BufSize, in: string FileName,
                 out: int Result);

inpainit()
{    
    int res;
    string buff;
    GetIniString("a", "b", "c", buff, 12, "foo", res);
}

inpaexit()
{
  
}

=== Constants @ 0x00c8 ===
[0 : 0000] offset=0x00e0 type=string (0x06) value=c
[1 : 0001] offset=0x00e3 type=string (0x06) value=kernel32::GetPrivateProfileStringA:c.sssSisI%
[2 : 0002] offset=0x0112 type=string (0x06) value=a
[3 : 0003] offset=0x0115 type=string (0x06) value=b
[4 : 0004] offset=0x0118 type=string (0x06) value=c
[5 : 0005] offset=0x011b type=int (0x03) value=12
[6 : 0006] offset=0x011e type=string (0x06) value=foo

=== Function: [2] inpainit (offset 0x0010, size 12) ===
0x0023: 08 51 00 00
0x0027: 08 55 00 00
0x002b: 0f 00 00 00
0x002f: 01 01 02 00
0x0033: 01 01 03 00
0x0037: 01 01 04 00
0x003b: 02 02 01 00
0x003f: 01 01 05 00
0x0043: 01 01 06 00
0x0047: 02 02 00 00
0x004b: 0d 01 01 00
0x004f: 0e 00 00 00


---


inpainit()
{    
    int res;
    long res1;
    string buff;
    GetIniString("a", "b", "c", buff, 12, "foo", res);
    DoWork(1, res1);
}

inpaexit()
{
  
}

import32 "c" lib "kernel32::GetPrivateProfileStringA"  GetIniString(in: string Section, in: string Key, in: string Default,
                 out: string Buffer, in: int BufSize, in: string FileName,
                 out: int Result);

import32 "c"" lib "mylib32:DoWork" DoWork(in: long value, out: long result);

--- 


import32 "C" lib "api32.DLL::__apiGetConfig" ApiGetConfig(in:long Handle,in: string Name,out: string Buffer, returns: int ReturnedValue);
import32 "C" lib "api32.DLL::__apiSetConfig" ApiSetConfig(in:long Handle,in: string Name,in:  string Buffer, returns: int ReturnedValue);


inpainit()
{    
    int ret; 
    string buff;
    ApiGetConfig(1, "s", buff, ret);
    ApiSetConfig(1, "s", buff, ret);    
}

inpaexit()
{
  
}

=== Globals @ 0x00bd ===
[0 : 0000] type=void (0x00)

=== Constants @ 0x00d4 ===
[0 : 0000] offset=0x00ec type=string (0x06) value=C
[1 : 0001] offset=0x00ef type=string (0x06) value=api32.DLL::__apiGetConfig:c.lsS%I
[2 : 0002] offset=0x0112 type=string (0x06) value=C
[3 : 0003] offset=0x0115 type=string (0x06) value=api32.DLL::__apiSetConfig:c.lss%I
[4 : 0004] offset=0x0138 type=long (0x04) value=1
[5 : 0005] offset=0x013d type=string (0x06) value=s
[6 : 0006] offset=0x0140 type=long (0x04) value=1
[7 : 0007] offset=0x0145 type=string (0x06) value=s

=== Function: [2] inpainit (offset 0x0010, size 15) ===
0x0023: 08 51 00 00
0x0027: 08 55 00 00
0x002b: 0f 00 00 00
0x002f: 01 01 04 00
0x0033: 01 01 05 00
0x0037: 02 02 01 00
0x003b: 02 02 00 00
0x003f: 0d 01 01 00
0x0043: 0f 00 00 00
0x0047: 01 01 06 00
0x004b: 01 01 07 00
0x004f: 01 02 01 00
0x0053: 02 02 00 00
0x0057: 0d 01 03 00
0x005b: 0e 00 00 00

=== Function: [3] inpaexit (offset 0x005f, size 1) ===
0x0072: 0e 00 00 00

=== Function: [0] __inpa_startup__ (offset 0x0076, size 2) ===
0x0091: 0f 00 00 00
0x0095: 0c 80 02 00

=== Function: [1] __inpa_shutdown__ (offset 0x0099, size 2) ===
0x00b5: 0f 00 00 00
0x00b9: 0c 80 03 00

--- 

int i;

add(in: int a, in: int b, out: int res) {
    res = a+ b;
}

inpainit()
{    
    int res;
    res = 3;
    add(1, res, i); 
}

inpaexit()
{
  
}


=== Globals @ 0x00cf ===
[0 : 0000] type=void (0x00)
[1 : 0001] type=int (0x03)

=== Constants @ 0x00e7 ===
[0 : 0000] offset=0x00ff type=int (0x03) value=3
[1 : 0001] offset=0x0102 type=int (0x03) value=1

=== Function: [4] add (offset 0x0010, size 6) ===
0x001e: 01 02 00 00
0x0022: 01 02 01 00
0x0026: 09 60 00 00
0x002a: 07 02 02 00
0x002e: 05 00 01 00
0x0032: 0e 00 00 00

=== Function: [2] inpainit (offset 0x0036, size 10) ===
0x0049: 08 51 00 00
0x004d: 01 01 00 00
0x0051: 06 02 00 00
0x0055: 05 00 01 00
0x0059: 0f 00 00 00
0x005d: 01 01 01 00
0x0061: 01 02 00 00
0x0065: 02 00 01 00
0x0069: 0c 80 04 00
0x006d: 0e 00 00 00

=== Function: [3] inpaexit (offset 0x0071, size 1) ===
0x0084: 0e 00 00 00

=== Function: [0] __inpa_startup__ (offset 0x0088, size 2) ===
0x00a3: 0f 00 00 00
0x00a7: 0c 80 02 00

=== Function: [1] __inpa_shutdown__ (offset 0x00ab, size 2) ===
0x00c7: 0f 00 00 00
0x00cb: 0c 80 03 00

---- 

ret(in: int a, out: int res) {
    res = a;
}

inpainit()
{    
    int loc = 1;
    
    ret(loc, loc);
}

inpaexit()
{
  
}


=== Globals @ 0x00b7 ===
[0 : 0000] type=void (0x00)

=== Constants @ 0x00ce ===
[0 : 0000] offset=0x00e6 type=int (0x03) value=1

=== Function: [4] ret (offset 0x0010, size 4) ===
0x001e: 01 02 00 00
0x0022: 07 02 01 00
0x0026: 05 00 01 00
0x002a: 0e 00 00 00

=== Function: [2] inpainit (offset 0x002e, size 6) ===
0x0041: 01 01 00 00
0x0045: 0f 00 00 00
0x0049: 01 02 00 00
0x004d: 02 02 00 00
0x0051: 0c 80 04 00
0x0055: 0e 00 00 00

---

ret(in: int a, out: int res) {
    res = a;
}

inpainit()
{    
    int loc;
    loc = 1;
    
    ret(loc, loc);
}

inpaexit()
{
  
}

=== Constants @ 0x00da ===
[0 : 0000] offset=0x00f2 type=int (0x03) value=1

=== Function: [4] ret (offset 0x0010, size 4) ===
0x001e: 01 02 00 00
0x0022: 07 02 01 00
0x0026: 05 00 01 00
0x002a: 0e 00 00 00

=== Function: [2] inpainit (offset 0x002e, size 9) ===
0x0041: 08 51 00 00
0x0045: 01 01 00 00
0x0049: 06 02 00 00
0x004d: 05 00 01 00
0x0051: 0f 00 00 00
0x0055: 01 02 00 00
0x0059: 02 02 00 00
0x005d: 0c 80 04 00
0x0061: 0e 00 00 00

--- 



=== Constants @ 0x00e2 ===
[0 : 0000] offset=0x00fa type=int (0x03) value=1
[1 : 0001] offset=0x00fd type=int (0x03) value=2

=== Function: [4] ret (offset 0x0010, size 4) ===
ret(in: int a, out: int res) {
    res = a;
}

0x001e: 01 02 00 00
0x0022: 07 02 01 00
0x0026: 05 00 01 00 ; stre
0x002a: 0e 00 00 00

=== Function: [2] inpainit (offset 0x002e, size 11) ===

inpainit()
{    
    int loc = 1;    
    ret(loc, loc);
    loc = loc + 2;
}


0x0041: 01 01 00 00
0x0045: 0f 00 00 00
0x0049: 01 02 00 00
0x004d: 02 02 00 00
0x0051: 0c 80 04 00
0x0055: 01 02 00 00
0x0059: 01 01 01 00
0x005d: 09 60 00 00 // result -> stack
0x0061: 06 02 00 00 // push onto stack ref where to store
0x0065: 05 00 01 00 // store
0x0069: 0e 00 00 00

---

=== Function: [4] ret (offset 0x0010, size 4) ===

ret(out: int res) {
    res = 1;
}

0x001e: 01 01 00 00 ; push const 0 
0x0022: 07 02 00 00 ; push out ref 0
0x0026: 05 00 01 00
0x002a: 0e 00 00 00

=== Function: [2] inpainit (offset 0x002e, size 10) ===

inpainit()
{    
    int loc; 
    ret(loc);
    loc = loc + 2;
}

0x0041: 08 51 00 00
0x0045: 0f 00 00 00
0x0049: 02 02 00 00
0x004d: 0c 80 04 00
0x0051: 01 02 00 00
0x0055: 01 01 01 00
0x0059: 09 60 00 00
0x005d: 06 02 00 00
0x0061: 05 00 01 00

---

=== Constants @ 0x00f2 ===
[0 : 0000] offset=0x010a type=int (0x03) value=1
[1 : 0001] offset=0x010d type=int (0x03) value=2

ret(out: int res, out: int res2) {
    res = 1;
    res2 = 2;
}

=== Function: [4] ret (offset 0x0010, size 7) ===
0x001e: 01 01 00 00
0x0022: 07 02 00 00
0x0026: 05 00 01 00
0x002a: 01 01 01 00
0x002e: 07 02 01 00
0x0032: 05 00 01 00
0x0036: 0e 00 00 00

inpainit()
{    
    int loc; 
    int l2;
    ret(loc, l2);
    loc = loc + l2;
}

=== Function: [2] inpainit (offset 0x003a, size 12) ===
0x004d: 08 51 00 00
0x0051: 08 51 00 00
0x0055: 0f 00 00 00
0x0059: 02 02 00 00
0x005d: 02 02 01 00
0x0061: 0c 80 04 00
0x0065: 01 02 00 00
0x0069: 01 02 01 00
0x006d: 09 60 00 00
0x0071: 06 02 00 00
0x0075: 05 00 01 00
0x0079: 0e 00 00 00

---

ret(out: int res, out: int res2) {
    int d;
    res = 1;
    res2 = 2;
}

inpainit()
{    
    int loc; 
    int l2;
    ret(loc, l2);
    loc = loc + l2;
}
=== Function: [4] ret (offset 0x0010, size 8) ===
0x001e: 08 51 00 00
0x0022: 01 01 00 00
0x0026: 07 02 00 00
0x002a: 05 00 01 00
0x002e: 01 01 01 00
0x0032: 07 02 01 00
0x0036: 05 00 01 00
0x003a: 0e 00 00 00

=== Function: [2] inpainit (offset 0x003e, size 12) ===
0x0051: 08 51 00 00
0x0055: 08 51 00 00
0x0059: 0f 00 00 00
0x005d: 02 02 00 00
0x0061: 02 02 01 00
0x0065: 0c 80 04 00
0x0069: 01 02 00 00
0x006d: 01 02 01 00
0x0071: 09 60 00 00
0x0075: 06 02 00 00
0x0079: 05 00 01 00
0x007d: 0e 00 00 00

---

=== Constants @ 0x0102 ===
[0 : 0000] offset=0x011a type=int (0x03) value=23
[1 : 0001] offset=0x011d type=int (0x03) value=1
[2 : 0002] offset=0x0120 type=int (0x03) value=2

ret(out: int res, out: int res2) {
    int d;
    d = 23;
    res = 1;
    res2 = 2;
}

=== Function: [4] ret (offset 0x0010, size 11) ===
0x001e: 08 51 00 00
0x0022: 01 01 00 00
0x0026: 06 02 02 00
0x002a: 05 00 01 00
0x002e: 01 01 01 00
0x0032: 07 02 00 00
0x0036: 05 00 01 00
0x003a: 01 01 02 00
0x003e: 07 02 01 00
0x0042: 05 00 01 00
0x0046: 0e 00 00 00

inpainit()
{    
    int loc; 
    int l2;
    ret(loc, l2);
    loc = loc + l2;
}

=== Function: [2] inpainit (offset 0x004a, size 12) ===
0x005d: 08 51 00 00
0x0061: 08 51 00 00
0x0065: 0f 00 00 00
0x0069: 02 02 00 00
0x006d: 02 02 01 00
0x0071: 0c 80 04 00
0x0075: 01 02 00 00
0x0079: 01 02 01 00
0x007d: 09 60 00 00
0x0081: 06 02 00 00
0x0085: 05 00 01 00
0x0089: 0e 00 00 00

---

=== Function: [4] ret (offset 0x0010, size 11) ===

ret(out: int res, out: int res2) {
    int d;
    d = 23;
    res = 1;
    res2 = 2;
}

0x001e: 08 51 00 00
0x0022: 01 01 00 00
0x0026: 06 02 02 00
0x002a: 05 00 01 00
0x002e: 01 01 01 00
0x0032: 07 02 00 00
0x0036: 05 00 01 00
0x003a: 01 01 02 00
0x003e: 07 02 01 00 target ref arg
0x0042: 05 00 01 00
0x0046: 0e 00 00 00

=== Function: [2] inpainit (offset 0x004a, size 16) ===

inpainit()
{    
    int first;
    int loc; 
    int l2;
    first = 8;
    ret(loc, l2);
    loc = loc + l2;
}

0x005d: 08 51 00 00
0x0061: 08 51 00 00
0x0065: 08 51 00 00
0x0069: 01 01 03 00
0x006d: 06 02 00 00
0x0071: 05 00 01 00
0x0075: 0f 00 00 00
0x0079: 02 02 01 00 // create ref arg to loc (ARg0)
0x007d: 02 02 02 00 // create ref arg ref to l2 (arg 0)
0x0081: 0c 80 04 00
0x0085: 01 02 01 00
0x0089: 01 02 02 00
0x008d: 09 60 00 00
0x0091: 06 02 01 00
0x0095: 05 00 01 00
0x0099: 0e 00 00 00

--- 

=== Constants @ 0x00fc ===
[0 : 0000] offset=0x0114 type=string (0x06) value=inpa.h
[1 : 0001] offset=0x011c type=int (0x03) value=1
[2 : 0002] offset=0x011f type=int (0x03) value=1
[3 : 0003] offset=0x0122 type=int (0x03) value=2
[4 : 0004] offset=0x0125 type=int (0x03) value=2
[5 : 0005] offset=0x0128 type=int (0x03) value=3
[6 : 0006] offset=0x012b type=int (0x03) value=4

inpainit()
{
    int a;

    a = 1;

    if (a == 1) {
        a = 2;
    }

    if (a == 2) {
        a = 3;
    } else {
        a = 4;
    }
}

=== Function: [2] inpainit (offset 0x0010, size 25) ===
0x0023: 08 51 00 00
0x0027: 01 01 01 00
0x002b: 06 02 00 00
0x002f: 05 00 01 00
0x0033: 01 02 00 00
0x0037: 01 01 02 00
0x003b: 09 68 00 00
0x003f: 05 00 01 00 ; ???
0x0043: 0b 00 0c 00 ; jump false by 12?
0x0047: 01 01 03 00 a = 2
0x004b: 06 02 00 00
0x004f: 05 00 01 00
0x0053: 01 02 00 00 <-------------------|
0x0057: 01 01 04 00
0x005b: 09 68 00 00
0x005f: 05 00 01 00 -- STORE? FLAGS?
0x0063: 0b 00 15 00 jmp if a != 2  by 21 to 0x007b
0x0067: 01 01 05 00 a = 3
0x006b: 06 02 00 00
0x006f: 05 00 01 00
0x0073: 0a 00 18 00
0x0077: 01 01 06 00 a = 4
0x007b: 06 02 00 00
0x007f: 05 00 01 00
0x0083: 0e 00 00 00

---


> inpax@0.0.0 cli /Users/mjaskols/Projects/my/inpax
> node packages/cli/dist/index.js "disasm" "/Volumes/emdzej/Documents/mj-test/T06_if_else.ipo"

0x0279: === G: Global Data ===
[0 : 0x0000] type=void (0x00)

0x0290: === C: Constant Data ===
[0 : 0x0000] offset=0x02A8 type=int (0x03) value=1
[1 : 0x0001] offset=0x02AB type=int (0x03) value=2
[2 : 0x0002] offset=0x02AE type=bool (0x01) value=true
[3 : 0x0003] offset=0x02B0 type=bool (0x01) value=true
[4 : 0x0004] offset=0x02B2 type=bool (0x01) value=true
[5 : 0x0005] offset=0x02B4 type=bool (0x01) value=true
[6 : 0x0006] offset=0x02B6 type=bool (0x01) value=true
[7 : 0x0007] offset=0x02B8 type=bool (0x01) value=true
[8 : 0x0008] offset=0x02BA type=bool (0x01) value=true
[9 : 0x0009] offset=0x02BC type=bool (0x01) value=true
[10 : 0x000A] offset=0x02BE type=bool (0x01) value=true
[11 : 0x000B] offset=0x02C0 type=bool (0x01) value=true
[12 : 0x000C] offset=0x02C2 type=bool (0x01) value=true

```c
inpainit()
{
    int a = 1;
    int b = 2;
    bool c;
    bool d = TRUE;
    c = a == b;
    c = a != b;
  
    c = a < b;
    c = a > b;
    c = a <= b;
    c = a >= b;

    d = !c;
    d = c && d;
    d = c || d;
    d = c ^^ d;
    b = a & b;
    b = a | b;
    b = a ^ b;

    if (a < b) 
    {
        c = TRUE;
    }

    if (a > b) 
    {
        c = TRUE;
    }

    if (a <= b)
    {
        c = TRUE;
    }

    if (a >= b)
    {
        c = TRUE;
    }

    if (c)
    {
        d =TRUE;
    }

    if (!c) 
    {
        d = TRUE;
    }

    if (c && d) 
    {
        d = TRUE;
    }

    if (c || d )
    {
        d = TRUE;
    }
}

inpaexit() 
{
    
}
```

0x0010: === F: inpainit: [0x0002] ===
0x0023: 01 01 00 00 ; LOAD CONST #[0] ; 1
0x0027: 01 01 01 00 ; LOAD CONST #[1] ; 2
0x002B: 08 50 00 00 ; ALLOC BOOL
0x002F: 01 01 02 00 ; LOAD CONST #[2] ; true
0x0033: 01 02 00 00 ; LOAD LOCAL #[0]
0x0037: 01 02 01 00 ; LOAD LOCAL #[1]
0x003B: 09 68 00 00 ; EQ
0x003F: 06 02 02 00 ; LOADREF LOCAL #[2]
0x0043: 05 00 01 00 ; STORE
0x0047: 01 02 00 00 ; LOAD LOCAL #[0]
0x004B: 01 02 01 00 ; LOAD LOCAL #[1]
0x004F: 09 69 00 00 ; NE
0x0053: 06 02 02 00 ; LOADREF LOCAL #[2]
0x0057: 05 00 01 00 ; STORE
0x005B: 01 02 00 00 ; LOAD LOCAL #[0]
0x005F: 01 02 01 00 ; LOAD LOCAL #[1]
0x0063: 09 64 00 00 ; LT
0x0067: 06 02 02 00 ; LOADREF LOCAL #[2]
0x006B: 05 00 01 00 ; STORE
0x006F: 01 02 00 00 ; LOAD LOCAL #[0]
0x0073: 01 02 01 00 ; LOAD LOCAL #[1]
0x0077: 09 65 00 00 ; GT
0x007B: 06 02 02 00 ; LOADREF LOCAL #[2]
0x007F: 05 00 01 00 ; STORE
0x0083: 01 02 00 00 ; LOAD LOCAL #[0]
0x0087: 01 02 01 00 ; LOAD LOCAL #[1]
0x008B: 09 66 00 00 ; LE
0x008F: 06 02 02 00 ; LOADREF LOCAL #[2]
0x0093: 05 00 01 00 ; STORE
0x0097: 01 02 00 00 ; LOAD LOCAL #[0]
0x009B: 01 02 01 00 ; LOAD LOCAL #[1]
0x009F: 09 67 00 00 ; GE
0x00A3: 06 02 02 00 ; LOADREF LOCAL #[2]
0x00A7: 05 00 01 00 ; STORE
0x00AB: 01 02 02 00 ; LOAD LOCAL #[2]
0x00AF: 09 6E 00 00 ; NOT
0x00B3: 06 02 03 00 ; LOADREF LOCAL #[3]
0x00B7: 05 00 01 00 ; STORE
0x00BB: 01 02 02 00 ; LOAD LOCAL #[2]
0x00BF: 01 02 03 00 ; LOAD LOCAL #[3]
0x00C3: 09 6A 00 00 ; AND
0x00C7: 06 02 03 00 ; LOADREF LOCAL #[3]
0x00CB: 05 00 01 00 ; STORE
0x00CF: 01 02 02 00 ; LOAD LOCAL #[2]
0x00D3: 01 02 03 00 ; LOAD LOCAL #[3]
0x00D7: 09 6B 00 00 ; OR
0x00DB: 06 02 03 00 ; LOADREF LOCAL #[3]
0x00DF: 05 00 01 00 ; STORE
0x00E3: 01 02 02 00 ; LOAD LOCAL #[2]
0x00E7: 01 02 03 00 ; LOAD LOCAL #[3]
0x00EB: 09 6C 00 00 ; Unknown(0x6c)
0x00EF: 06 02 03 00 ; LOADREF LOCAL #[3]
0x00F3: 05 00 01 00 ; STORE
0x00F7: 01 02 00 00 ; LOAD LOCAL #[0]
0x00FB: 01 02 01 00 ; LOAD LOCAL #[1]
0x00FF: 09 6F 00 00 ; Unknown(0x6f)
0x0103: 06 02 01 00 ; LOADREF LOCAL #[1]
0x0107: 05 00 01 00 ; STORE
0x010B: 01 02 00 00 ; LOAD LOCAL #[0]
0x010F: 01 02 01 00 ; LOAD LOCAL #[1]
0x0113: 09 70 00 00 ; Unknown(0x70)
0x0117: 06 02 01 00 ; LOADREF LOCAL #[1]
0x011B: 05 00 01 00 ; STORE
0x011F: 01 02 00 00 ; LOAD LOCAL #[0]
0x0123: 01 02 01 00 ; LOAD LOCAL #[1]
0x0127: 09 71 00 00 ; Unknown(0x71)
0x012B: 06 02 01 00 ; LOADREF LOCAL #[1]
0x012F: 05 00 01 00 ; STORE
0x0133: 01 02 00 00 ; LOAD LOCAL #[0]
0x0137: 01 02 01 00 ; LOAD LOCAL #[1]
0x013B: 09 64 00 00 ; LT
0x013F: 05 00 01 00 ; STORE
0x0143: 0B 00 4C 00
0x0147: 01 01 03 00 ; LOAD CONST #[3] ; true
0x014B: 06 02 02 00 ; LOADREF LOCAL #[2]
0x014F: 05 00 01 00 ; STORE
0x0153: 01 02 00 00 ; LOAD LOCAL #[0]
0x0157: 01 02 01 00 ; LOAD LOCAL #[1]
0x015B: 09 65 00 00 ; GT
0x015F: 05 00 01 00 ; STORE
0x0163: 0B 00 54 00
0x0167: 01 01 04 00 ; LOAD CONST #[4] ; true
0x016B: 06 02 02 00 ; LOADREF LOCAL #[2]
0x016F: 05 00 01 00 ; STORE
0x0173: 01 02 00 00 ; LOAD LOCAL #[0]
0x0177: 01 02 01 00 ; LOAD LOCAL #[1]
0x017B: 09 66 00 00 ; LE
0x017F: 05 00 01 00 ; STORE
0x0183: 0B 00 5C 00
0x0187: 01 01 05 00 ; LOAD CONST #[5] ; true
0x018B: 06 02 02 00 ; LOADREF LOCAL #[2]
0x018F: 05 00 01 00 ; STORE
0x0193: 01 02 00 00 ; LOAD LOCAL #[0]
0x0197: 01 02 01 00 ; LOAD LOCAL #[1]
0x019B: 09 67 00 00 ; GE
0x019F: 05 00 01 00 ; STORE
0x01A3: 0B 00 64 00
0x01A7: 01 01 06 00 ; LOAD CONST #[6] ; true
0x01AB: 06 02 02 00 ; LOADREF LOCAL #[2]
0x01AF: 05 00 01 00 ; STORE
0x01B3: 01 02 02 00 ; LOAD LOCAL #[2]
0x01B7: 05 00 01 00 ; STORE
0x01BB: 0B 00 6A 00
0x01BF: 01 01 07 00 ; LOAD CONST #[7] ; true
0x01C3: 06 02 03 00 ; LOADREF LOCAL #[3]
0x01C7: 05 00 01 00 ; STORE
0x01CB: 01 02 02 00 ; LOAD LOCAL #[2]
0x01CF: 09 6E 00 00 ; NOT
0x01D3: 05 00 01 00 ; STORE
0x01D7: 0B 00 71 00
0x01DB: 01 01 08 00 ; LOAD CONST #[8] ; true
0x01DF: 06 02 03 00 ; LOADREF LOCAL #[3]
0x01E3: 05 00 01 00 ; STORE
0x01E7: 01 02 02 00 ; LOAD LOCAL #[2]
0x01EB: 01 02 03 00 ; LOAD LOCAL #[3]
0x01EF: 09 6A 00 00 ; AND
0x01F3: 05 00 01 00 ; STORE
0x01F7: 0B 00 79 00
0x01FB: 01 01 09 00 ; LOAD CONST #[9] ; true
0x01FF: 06 02 03 00 ; LOADREF LOCAL #[3]
0x0203: 05 00 01 00 ; STORE
0x0207: 01 02 02 00 ; LOAD LOCAL #[2]
0x020B: 01 02 03 00 ; LOAD LOCAL #[3]
0x020F: 09 6B 00 00 ; OR
0x0213: 05 00 01 00 ; STORE
0x0217: 0B 00 81 00
0x021B: 01 01 0A 00 ; LOAD CONST #[10] ; true
0x021F: 06 02 03 00 ; LOADREF LOCAL #[3]
0x0223: 05 00 01 00 ; STORE
0x0227: 0E 00 00 00 ; RET


