# INPA - Interpreter for Test Procedures (V2.2)

## 1. Introduction

With the introduction of new control units or control unit versions in production, a diagnostic program for this control unit, for example for post-processing, must be provided. In the past this has been done by expanding the diagnostic programs developed for use in after-sales service.

To allow us to react more flexibly and above all faster to the requirements in the factory, initially a prototype, then later, in the expansion phase 1, an independent test procedure system was developed that enables a skilled executive on site to develop rework programs for the plant.

These rework programs are formulated in a test procedure description language, which, in turn, was also expanded in the current expansion phase 2 to take account of the requirements to provide it with as universal a scope as possible. The INPA (interpreter for test procedures) system described in this document is notable for the following properties:

*   Easy to learn
*   Immediate control of the created test program by interactive drafting
*   Convenient facilities for screen output
*   Convenient facilities for controlling the procedure
*   Simple facility for formulating quasi-simultaneous actions
*   Extensive library with standard functions, for example:
    *   Configuration of the screen layout (front and background colour, font size)
    *   Configuration of message windows
    *   Output to printer
    *   Screen shots
    *   File access
    *   String and conversion functions
    *   Standard interface (with and without result evaluation by the INPA system) for Electronic DIAgnostic BAse System (EDIABAS)

In keeping with the intended area of application of INPA, access to information about the vehicle (and of the control module that requires diagnostic) is through the electronic diagnostic base system EDIABAS and through the EDIC hardware.

## 2. Overview

This document is designed to help users to understand the interpreter for test procedures (INPA); readers of this user documentation are given an overview of the possible applications and the components of the INPA that are visible for the user in section 3.

Section 5 describes the structure of the test procedure description files, the principle procedure used for tests and the language elements (for example including the functions of the standard library) used to describe (and to execute) tests. This will enable readers to formulate and run tests in a test procedure description language. The listing of the language element in sub-section 5.3 is also intended to act as a reference.

Section 6 provides a rough overview of the software structure and the components of the INPA procedure system. This section is intended to explain the outline relationships between the modules in terms of software update action.

This INPA user documentation is aimed at the following:

*   Staff in departments at BMW, who define or change test procedures in the production departments
*   Staff in departments at BMW, who define laboratory tests
*   Developers of application programs who include test procedures in the electronic diagnostic system (ELD) on the production line
*   Software developers, who are responsible for INPA system support

## 3. System Description

The INPA system is based on WINDOWS and therefore requires a PC 80386 (or higher) with 4 MB RAM (or more) to run properly. In addition an interface to the vehicle or to a control module, an Enhanced Diagnostic Interface Computer (EDIC) is provided.
Communication with the EDIC is controlled by the electronic diagnostic base system, which must be available in the form of a dynamic link library (DLL).

Typical applications for INPA include the following:

*   Rework programs, in other words stand-alone programs for diagnosing a single control module
*   "Fast tests", in other words test procedures that are only used one or just a few times or which are subject to frequent changes (for example tests during development or in the laboratory)
*   Special tasks such as ELDI special jobs, with the inclusion of the INPA test procedure in the ELDI procedures

Test procedure programs are developed by a trained executive on site, who is given a correspondingly flexible description language for this purpose. Using an (arbitrary) ASCII editor, test procedure description files are produced for test procedures in the above description language.

These description files are processed by interpretation during the run time of the INPA, during which the system is supported by the components shown in schematic form in Figure 1.

To reduce the loading times for the test procedure description files and to minimise memory requirements, the INPA system has been implemented in such a way that it can be operated in configurable modes, namely in the following forms:

*   An integrated system for the interactive development of test procedure descriptions and to compile the created descriptions so that they can be loaded and processed during the run time of the INPA using minimum time and memory.
*   INPA loader to load and process pre-compiled test procedure description files. The INPA loader configuration is used at the place where the test is used.

The INPA system allows arbitrary test procedures written in the test procedure description language (PABS) to be run; this means the following for the tests:

*   Automatic procedures or procedures controlled by the user from the keyboard can be formulated
*   Test results (or other output) can be output on the screen or in a file (protocol), or they can be returned in the form of a return value to the program that activated the system

The test procedures formulated in the test procedure description files (PABS) typically include the following tasks:

*   Description of the test procedure tree by a menu controller
*   Structure of the communication with a control module
*   Request for data from a control module
*   Evaluation of the data (results)
*   Linking several results
*   Display of the (linked) results on the screen

In addition PABS also provides elements to describe the screen layout (colours and fonts), control structures, such as Boolean operations, conditional commands and loops for the evaluation and display of results.

## 4. Installation and Configuration

### 4.1. Installation

#### 4.1.1. Requirements for operating the interpreter

EDIABAS must be installed to operate the interpreter.

#### 4.1.2. Files after installation

*   `README`: File containing general information on the installation diskette
*   `README.xyz`: Readme for INPA Vx.y.z for the specific version

**BIN directory**

*   `INPA.EXE`: Interpreter for test procedures, integrated system with compiler, loader and interpreter
*   `INPACOMP.EXE`: Compiler for script files
*   `INPALOAD.EXE`: Run time system with loader and interpreter
*   `INPAGER.DLL`: German foreign language support
*   `INPAUS.DLL`: English foreign language support
*   `WEPEM.DLL`: Protocol and label manager DLL
*   `WEDTM.DLL`: Data table manager DLL
*   `WEFABM.DLL`: Error mask-out DLL
*   `ATRACE.DLL`: Trace DLL
*   `DEUTSCH.DLL`: Language DLL from Wineldi
*   `ENGLISCH.DLL`: Language DLL from Wineldi
*   `E3_SPR.DLL`: Language help DLL from Wineldi
*   `WEEDIA.DLL`: Joint WINELDI / INPA link to EDIABAS
*   `WINPRINT.DLL`: Printer manager
*   `RK512.DLL`: RK512 communication DLL

The following are also required for operation with the WINELDI input handler:

*   `E3X_EINH.EXE`: WINELDI/3 input handler
*   `DECODE.DLL`: Decoding the order data
*   `QSDMAN.DLL`: Quality assurance data
*   `WENETM.DLL`: Network link of the input handler
*   `EDIERROR.TXT`: German language support for EDIABAS
*   `EDIERROR.ENG`: English language support for EDIABAS
*   `USRDUMMY.DLL`: Substitute for the WINELDI screen server
*   `BMDUMMY.DLL`: Substitute for the WINELDI screen server
*   `NET.DAT`: Settings for the network manager
*   `WXSEMAPH.DLL`: Flags for WINELDI and MOTEST (used by input handler)

**CFGDAT directory**

*   `INPA.INI`: Configuration file for INPA tools
*   `INPASCR.INI`: Script selection file for INPA and INPALOAD
*   `STARTGER.IPS`: Startup script for interpreter (source), German
*   `STARTUS.IPS`: Startup script for interpreter (source), English
*   `STARTGER.IPO`: Startup script for interpreter (object), German
*   `STARTUS.IPO`: Startup script for interpreter (object), English

**HELP directory**

*   `INPAHELP.HLP`: Windows help file for INPA

**PRT directory**

*   `*.ini`: Printer initialisation files
*   `INPADOS.DMF`: Print mask file for INPA screen shorts via PEM
*   `INPAWIN.DMF`: Print mask file for INPA screen shorts via Windows standard printer
*   `./ENGLISH` or `./GERMAN`: Language-dependent versions of the:
    *   `E3ETIKET.DMF`: Label print mask file (used by PEM internally)
    *   `E3PROTOK.DMF`: Protocol print mask file (used by PEM internally)

**TRACE directory**

(contains the temporary file for INPA screenshot for operation without a printer)
("PRINTER=NO" in INPA configuration file)

**FAB directory**

(contains the user’s error mask-out files)

**SGDAT directory**

*   `INPA.H`: Header file with prototype of the INPA library functions

(also contains the user’s script files)

**DEMO directory**

(contains optional demonstration files for special INPA functions)

#### 4.1.3. To set up the interpreter

The program is installed by running `setup.exe` in Windows.
During the installation the destination path must be entered (default: `c:\inpa`).

### 4.2. Configuration

The configuration of INPA is completed using two configuration files, which are contained in the `\CFGDAT` directory:

*   Configuration file `..\CFGDAT\inpa.ini` determines the configuration for the INPA tools
*   Configuration file `..\CFGDAT\inpascr.ini` is used as a default script selection file for INPA and INPALOAD

#### 4.2.1. General program configuration

The general configuration of the INPA tools is completed using the configuration file `inpa.ini`.
This has the following structure (example):

```ini
[FAB]
FAB FILES= \INPA\FAB

[ENVIRON]
PRINTER=NO
NETWORK=NO
BARCODE=NO
PEM=YES
DTM=YES
NETWORK DATA=\inpa\bin\net.dat
DECODING TABLE_D_ALL=c:\WINELDI\CFGDATEN\FP_D.DET
DECODINT TABLE_E_E36=c:\WINELDI\CFGDATEN\FP_E_36.DET
SPLITTINGFILE=.. ..\CFGDAT\SPLIT.DET

LANGUAGE=GERMAN
EDITOR=DOS
SCRIPTSELECT=LIST
DEFINI=inpascr.ini
```

The configuration files have the format of Windows INI files. They contain various selections, whose names are in square brackets (for example: `[FAB]`), which in turn contain various entries.

#### 4.2.2. Structured script selection

The script selection system is activated using the `scriptselect` function, which contains the name of the INI file to be used for the script selection process in the form of its function parameter.

Example structure of a script selection file:

```ini
[ROOT]
DESCRIPTION=Vehicles

[ROOT_SERIES1]
DESCRIPTION=Series 1
ENTRY=sg1,Control module 1
ENTRY=sg2,Control module 2

[ROOT_SERIES2]
DESCRIPTION=Series 2
ENTRY=sg3,Control module 3
ENTRY=sg4,Control module 4

[ROOT_SERIES2_SPECIAL]
DESCRIPTION=Special tests
ENTRY=brieftst,brief test
```

#### 4.2.3. Error mask-out files

For each SG version, for which one or more errors are to be masked out, there must be a separate error mask-out file named `<sgbd>.FAB`.

Example of a FAB file (`DME331.FAB`):

```ini
; FAB-Section
[FAB]
Error= 2 3 4 5 6 7

; F-ORT-NR - Sections
; for error 2, 'Idling adjuster/Closing coil
[2]
AB=AB1 AB2 AB4

; AB - Sections
[AB1]
Con1=AAB 10
Con2=FS_READ APITEXT F_ART1_TEXT == "Error saved after debouncing"
Con3=FS_READ APIREAL F_UW1_WERT > "1500"
Con4=FS_READ APIREAL F_UW1_WERT < "2300"
```

## 5. Test Procedure Description Files

### 5.1. File structure

The test procedure description files follow a specific structure with optional and mandatory sections.

*   Includes
*   Imported functions (optional)
*   Global data definitions (optional)
*   Test procedure description

#### 5.1.1. Pragmas

Pragmas control the compilation process.

```c
#pragma winedit // No OEMToAnsi conversion
#pragma dosedit // OEMToAnsi conversion
```

#### 5.1.2. Includes

```c
#include "inpa.h"
```

#### 5.1.3. Imported functions

Allows inclusion of external DLL functions.

```c
import pascal lib "user.exe" MessageBox(in: int Hwnd, in: string MyText, in: string Title, in: flags, returns: int ret);
```

#### 5.1.5. Global data definitions

Supported data types:
*   `byte` (8-bit integer)
*   `int` (16-bit integer)
*   `long` (32-bit integer)
*   `real` (floating point, double precision)
*   `bool` (TRUE or FALSE)
*   `string` (null-terminated string)

Example:
```c
byte a = 41;
int i;
long l = -20000;
real pressure, temp;
bool valid = FALSE;
string status = "open";
```

#### 5.1.6. Test procedure description

A minimal test procedure must contain `inpainit()` and `inpaexit()`.

```c
inpainit ()
{
    settitle ("Title of initial screen");
    setscreen (<Name of initial screen>);
    setmenu (<Name of initial menu>);
}

inpaexit ()
{
    /* User-specified end instructions (optional)*/
}
```

### 5.3. Language elements

#### 5.3.3. Screen display

Screens are defined using `SCREEN` constructs.

```c
SCREEN s_main ()
{
    text( 1, 0, "Identification data control module XYZ");
    INPAapiJob("XYZ","IDENT","","");
    INPAapiCheckJobStatus("OKAY");

    LINE ( "Part number", "")
    {
       text( 0, 1, "Part number: ");
       INPAapiResultText(t0,"ID_NR",1,"");
       textout( t0, 0, 35);
    }
}
```

#### 5.3.4. Menu control

Menus define user interactions.

```c
MENU m_main ()
{
    INIT {
       INPAapiInit();
       setmenutitle( "Default menu");
    }

    ITEM( 2 , "Ident")  {
       setscreen( s_ident ,TRUE);
       setmenu( m_ident );
    }

    ITEM( 20 , "End")  {
       exit();
    }
}
```

#### 5.3.5. State machines

State machines allow for pseudo-parallel background actions.

```c
STATE MACHINE sm_example()
{
    INIT
    {
        setstate(STATE_1);
    }

    STATE_1
    {
        // Do something
        setstate(STATE_2);
    }

    STATE_2
    {
        // Do something else
    }
}
```

#### 5.3.7. Control structures

*   Assignment: `=`
*   Comparison: `<`, `<=`, `!=`, `==`, `>=`, `>`
*   Logical links: `!`, `&&`, `||`, `^^`
*   Binary links: `&`, `|`, `^`
*   Loops: `while (expression) { ... }`
*   Conditional: `if (expression) { ... } else { ... }`

#### 5.3.8. Functions of the standard library

**System functions**
*   `setmenu(menu)`
*   `setscreen(screen, frequ)`
*   `settitle(screentitle)`
*   `delay(ms)`
*   `exit()`

**Output functions**
*   `text(row, col, text)`
*   `textout(variable, row, col)`
*   `analogout(variable, row, col, min, max, minvalid, maxvalid, format)`
*   `messagebox(title, text)`

**EDIABAS functions**
*   `INPAapiJob(ecu, job, para, result)`
*   `INPAapiResultText(var, result_name, set, format)`
*   `INPAapiResultAnalog(var, result_name, set)`
*   `INPAapiFsLesen(ecu, file)`

## Appendix B: Example of a Test Procedure

```c
// *****************************************************
// *** Includes
// *****************************************************

#include "inpa.h"

// *****************************************************
// *** Globals
// *****************************************************

string t0,t1,t2,t3;
real real0,real1;

// *****************************************************
// *** Main Screen
// *****************************************************

SCREEN s_main ()
{
    text( 1, 0, "Identification data");
    INPAapiJob("sm_rd","IDENT","","");
    INPAapiCheckJobStatus("OKAY");

    LINE ( "BMW_partnumber", "")
    {
       text( 0, 1, "BMW-part number: ");
       INPAapiResultText(t0,"ID_BMW_NR",1,"");
       textout( t0, 0, 35);
    }
}

MENU m_main ()
{
    INIT {
       INPAapiInit();
       setmenutitle( "Default menu");
    }
    ITEM( 1 , "Info")  {
       infobox("Information","Rework program example");
    }
    ITEM( 10 , "End")  {
       INPAapiJob("sm_rd","diagnostic_end","","");
       exit();
    }
}

inpainit()
{
   INPAapiInit();
   settitle( " SPM - redesign ");
   setmenu(m_main);
   setscreen(s_main,TRUE);
}

inpaexit()
{
   INPAapiEnd();
}
```
