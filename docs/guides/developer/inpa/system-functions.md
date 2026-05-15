# INPA System Functions Reference

This document provides a comprehensive reference of all INPA built-in functions, grouped by category.

## Table of Contents

- [System Control Functions](#system-control-functions)
- [EDIABAS Functions (with Error Handling)](#ediabas-functions-with-error-handling)
- [EDIABAS Functions (Direct - No Error Handling)](#ediabas-functions-direct---no-error-handling)
- [UI Output Functions](#ui-output-functions)
- [UI Input Functions](#ui-input-functions)
- [Userbox Functions](#userbox-functions)
- [File Access Functions](#file-access-functions)
- [File Viewer Functions](#file-viewer-functions)
- [String Functions](#string-functions)
- [String Array Functions](#string-array-functions)
- [Conversion Functions](#conversion-functions)
- [Timer Functions](#timer-functions)
- [Memory/Structure Functions](#memorystructure-functions)
- [Windows Interface Functions](#windows-interface-functions)
- [PEM (Protocol/Label Manager) Functions](#pem-protocollabel-manager-functions)
- [Simulation Functions](#simulation-functions)

---

## System Control Functions

### exit()
Terminates execution of the active script.

```
exit()
```

**Example:**
```c
ITEM(10, "End") {
    exit();
}
```

### exitwindows()
Exits Windows entirely.

```
exitwindows()
```

### delay(ms)
Pauses script execution for the specified number of milliseconds.

```
delay(in: int ms)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ms | int | Duration in milliseconds |

**Note:** Negative values are treated as 2's complement. For negative x: t = (65536 - |x|) ms

**Example:**
```c
delay(2000);  // Wait 2 seconds
```

### start()
Starts cyclic script processing.

```
start()
```

### stop()
Stops cyclic script processing.

```
stop()
```

### settitle(title)
Sets the window title.

```
settitle(in: string title)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| title | string | Window title text |

**Example:**
```c
settitle("SPM - Diagnostic Script");
```

### setmenu(menu)
Activates a menu.

```
setmenu(in: MENU m)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| m | MENU | Name of the menu to activate |

**Example:**
```c
setmenu(m_main);
```

### setmenutitle(title)
Sets the menu title.

```
setmenutitle(in: string title)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| title | string | Menu title text |

**Example:**
```c
MENU m_main() {
    INIT {
        setmenutitle("Main Menu");
    }
}
```

### setscreen(screen, frequ)
Activates a screen for display.

```
setscreen(in: SCREEN s, in: bool frequ)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| s | SCREEN | Name of the screen |
| frequ | bool | TRUE for cyclic refresh, FALSE for single pass |

**Example:**
```c
setscreen(s_main, TRUE);  // Cyclic refresh
setscreen(s_status, FALSE);  // Single pass
```

### setitem(nr, text, enable)
Changes menu item text and enable state.

```
setitem(in: int nr, in: string text, in: bool enable)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| nr | int | Item number (1-20) |
| text | string | New button text |
| enable | bool | TRUE to enable, FALSE to disable (grayed) |

**Note:** Disabled items appear grayed out and cannot be activated.

### setitemrepeat(nr, enable)
Enables repeated menu function calls while key is held.

```
setitemrepeat(in: int nr, in: bool enable)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| nr | int | Item number (1-20) |
| enable | bool | TRUE for repeat mode, FALSE for single-fire |

**Note:** Default behavior is single execution on key release.

### setcolor(fg, bg)
Configures screen and text colors.

```
setcolor(in: int FgColor, in: int BkColor)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| FgColor | int | Foreground color (0-15) |
| BkColor | int | Background color (0-15) |

**Color Values:**
| Value | Color |
|-------|-------|
| 0 | White |
| 1 | Black |
| 2 | Light Gray |
| 3 | Gray |
| 4 | Bright Red |
| 5 | Dark Red |
| 6 | Red-Violet |
| 7 | Red-Lilac |
| 8 | Bright Yellow |
| 9 | Olive |
| 10 | Bright Green |
| 11 | Dark Green |
| 12 | Light Cyan |
| 13 | Muted Cyan |
| 14 | Bright Blue |
| 15 | Blue |

### scriptselect(ininame)
Opens script selection dialog.

```
scriptselect(in: string ininame)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ininame | string | Name of script selection INI file, or "" for default |

**Example:**
```c
scriptselect("testscr.ini");
scriptselect("");  // Use default from config
```

### scriptchange(scriptname)
Changes to a different script without user interaction.

```
scriptchange(in: string scriptname)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| scriptname | string | Script path/name (without extension) |

**Examples:**
```c
scriptchange("TEST");           // Loads \INPA\SGDAT\TEST.IPO
scriptchange("..\CFGDAT\STARTUS");  // Relative path
scriptchange("C:\test\test");   // Absolute path
```

### select(multiSelectFlag)
Activates line selection mode for enlarged display.

```
select(in: bool MultipleSelectFlag)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| MultipleSelectFlag | bool | TRUE for multiple selection, FALSE for single |

**Note:** Selected combinations can be saved under a logical name ("Set").

### deselect()
Returns from enlarged display to full view.

```
deselect()
```

### control()
Activates control functionality for the active SCREEN.

```
control()
```

On the next SCREEN pass, statements in CONTROL blocks are executed once.

### printscreen()
Prints the visible screen area according to printer configuration.

```
printscreen()
```

### printfile(errorCode, fileName, printerName, printerPort, errorMsgFlag)
Prints a file to a Windows printer.

```
printfile(out: int ErrorCode, in: string FileName, in: string PrinterName, 
          in: string PrinterPort, in: bool ErrorMsgFlag)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ErrorCode | int (out) | Result code (see below) |
| FileName | string | File to print |
| PrinterName | string | Printer name ("" for default) |
| PrinterPort | string | Printer port ("" for default) |
| ErrorMsgFlag | bool | TRUE to show error dialogs |

**Error Codes:**
| Code | Meaning |
|------|---------|
| 0 | PRINT_OK |
| 1 | PRINT_GENERAL_ERROR |
| 2 | PRINT_DISK_ERROR |
| 3 | PRINT_MEMORY_ERROR |
| 4 | PRINT_CANCELED |
| 5 | PRINT_SPOOLER_ERROR |
| 6 | PRINT_FILE_ERROR |
| 7 | PRINT_SPOOLER_BUSY |
| 8 | PRINT_ILLEGAL_DEVICE |

### getdate(date)
Gets the system date.

```
getdate(out: string date)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| date | string (out) | Date in format "dd.mm.yyyy" |

### gettime(time)
Gets the system time.

```
gettime(out: string time)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| time | string (out) | Time in format "hh:mm:ss" |

### getapistring(argNumFlag, fullScreenFlag, apiString)
Gets API result parameters for the active SCREEN.

```
getapistring(in: bool ArgNumFlag, in: bool FullScreenFlag, out: string ApiString)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ArgNumFlag | bool | TRUE to prefix with parameter count |
| FullScreenFlag | bool | TRUE for entire SCREEN, FALSE for visible area |
| ApiString | string (out) | Concatenated API result parameters |

### togglelist(multiSelectFlag, argNumFlag, apiToggleString)
Shows a listbox for selecting logical lines.

```
togglelist(in: bool MultipleSelectFlag, in: bool ArgNumFlag, out: string ApiToggleString)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| MultipleSelectFlag | bool | TRUE for multiple selection |
| ArgNumFlag | bool | TRUE to prefix with count |
| ApiToggleString | string (out) | Selected API result parameters |

### setjobstatus(jobStatus)
Sets the job return status for WINELDI.

```
setjobstatus(in: int JobStatus)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| JobStatus | int | 0=OK, 1=NOT_OK, 2=block abort, 3=user abort, 4=fatal |

---

## EDIABAS Functions (with Error Handling)

These functions include automatic error handling with dialog boxes.

### INPAapiInit()
Initializes the EDIABAS Application Programming Interface.

```
INPAapiInit()
```

### INPAapiEnd()
Terminates EDIABAS connection.

```
INPAapiEnd()
```

### INPAapiJob(ecu, job, para, result)
Executes an EDIABAS job with error handling.

```
INPAapiJob(in: string ecu, in: string job, in: string para, in: string result)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ecu | string | ECU/SGBD name |
| job | string | Job name |
| para | string | Job parameters |
| result | string | Requested result values |

**Example:**
```c
INPAapiJob("sm_rd", "IDENT", "", "");
```

### INPAapiCheckJobStatus(refStr)
Checks JOB_STATUS result against expected value.

```
INPAapiCheckJobStatus(in: string RefStr)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| RefStr | string | Expected status (typically "OKAY") |

**Note:** Shows messagebox and stops cyclic processing if mismatch.

### INPAapiResultText(resultText, apiResult, apiSet, apiFormat)
Gets a text result from EDIABAS.

```
INPAapiResultText(out: string ResultText, in: string ApiResult, 
                  in: int ApiSet, in: string ApiFormat)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ResultText | string (out) | Result value |
| ApiResult | string | Result name to query |
| ApiSet | int | Result set number |
| ApiFormat | string | Format for conversion |

**Example:**
```c
INPAapiResultText(t0, "ID_BMW_NR", 1, "");
```

### INPAapiResultInt(resultVal, apiResult, apiSet)
Gets an integer result from EDIABAS.

```
INPAapiResultInt(out: int ResultVal, in: string ApiResult, in: int ApiSet)
```

### INPAapiResultAnalog(resultVal, apiResult, apiSet)
Gets a real/analog result from EDIABAS.

```
INPAapiResultAnalog(out: real ResultVal, in: string ApiResult, in: int ApiSet)
```

### INPAapiResultDigital(resultVal, apiResult, apiSet)
Gets a boolean/digital result from EDIABAS.

```
INPAapiResultDigital(out: bool ResultVal, in: string ApiResult, in: int ApiSet)
```

### INPAapiResultBinary(apiResult, apiSet)
Gets binary data from EDIABAS into internal buffer.

```
INPAapiResultBinary(in: string ApiResult, in: int ApiSet)
```

**Note:** Access data via `hexdump()` or `GetBinaryDataString()`.

### INPAapiResultSets(sets)
Gets the number of result sets from last job.

```
INPAapiResultSets(out: int sets)
```

### INPAapiFsLesen(ecu, fileName)
Reads fault memory and saves to file.

```
INPAapiFsLesen(in: string ecu, in: string FileName)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ecu | string | ECU/SGBD name |
| FileName | string | Output file name |

### INPAapiFsMode(fsMode, fsFileMode, preInfoFile, postInfoFile, apiFsJobName)
Configures fault memory reading behavior.

```
INPAapiFsMode(in: int FsMode, in: string FsFileMode, in: string PreInfoFile,
              in: string PostInfoFile, in: string ApiFsJobName)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| FsMode | int | Bit mask for detail display (see below) |
| FsFileMode | string | "w" for new file, "a" to append |
| PreInfoFile | string | File to insert before details ("" for none) |
| PostInfoFile | string | File to insert after details ("" for none) |
| ApiFsJobName | string | Job name ("" for default "FS_LESEN") |

**FsMode Bit Masks:**
| Mask | Description |
|------|-------------|
| 0x01 | Show fault locations |
| 0x02 | Show environment conditions |
| 0x04 | Show fault types |
| 0x08 | Show environment values (requires 0x02) |
| 0x10 | Show environment units (requires 0x02) |
| 0x20 | Show fault frequency |
| 0x40 | Show fault hex codes |
| 0x80 | Show hint texts |
| 0xFF | Show all (default) |

---

## EDIABAS Functions (Direct - No Error Handling)

These functions call API directly without automatic error handling.

### INP1apiInit(rc)
Initializes EDIABAS without error handling.

```
INP1apiInit(out: bool rc)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| rc | bool (out) | TRUE if successful |

### INP1apiEnd()
Terminates EDIABAS connection.

```
INP1apiEnd()
```

### INP1apiJob(ecu, job, para, result)
Executes an EDIABAS job without error handling.

```
INP1apiJob(in: string ecu, in: string job, in: string para, in: string result)
```

### INP1apiState(apiState)
Gets the state of the last API call.

```
INP1apiState(out: int ApiState)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ApiState | int (out) | 0=busy, 1=ready, 2=error |

### INP1apiResultText(rc, resultText, apiResult, apiSet, apiFormat)
Gets text result with success indicator.

```
INP1apiResultText(out: bool rc, out: string ResultText, in: string ApiResult,
                  in: int ApiSet, in: string ApiFormat)
```

### INP1apiResultInt(rc, resultVal, apiResult, apiSet)
Gets integer result with success indicator.

```
INP1apiResultInt(out: bool rc, out: int ResultVal, in: string ApiResult, in: int ApiSet)
```

### INP1apiResultReal(rc, resultVal, apiResult, apiSet)
Gets real result with success indicator.

```
INP1apiResultReal(out: bool rc, out: real ResultVal, in: string ApiResult, in: int ApiSet)
```

### INP1apiResultBinary(rc, apiResult, apiSet)
Gets binary result with success indicator.

```
INP1apiResultBinary(out: bool rc, in: string ApiResult, in: int ApiSet)
```

### INP1apiResultSets(rc, sets)
Gets result set count with success indicator.

```
INP1apiResultSets(out: bool rc, out: int sets)
```

### INP1apiErrorCode(errorCode)
Gets the current API error code.

```
INP1apiErrorCode(out: int ErrorCode)
```

### INP1apiErrorText(errorText)
Gets the current API error text.

```
INP1apiErrorText(out: string ErrorText)
```

### GetBinaryDataString(dataString, dataStringLen)
Returns EDIABAS binary buffer as hex string.

```
GetBinaryDataString(out: string DataString, out: int DataStringLen)
```

---

## UI Output Functions

### text(row, col, text)
Outputs text at specified position.

```
text(in: int row, in: int col, in: string text)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| row | int | Row (0-29) |
| col | int | Column (0-79) |
| text | string | Text to display |

### textout(text, row, col)
Outputs text variable at specified position.

```
textout(in: string text, in: int row, in: int col)
```

### ftextout(text, row, col, textsize, textattr)
Formatted text output with size and attributes.

```
ftextout(in: string text, in: int row, in: int col, in: int textsize, in: int textattr)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| text | string | Text to display |
| row | int | Row position |
| col | int | Column position |
| textsize | int | 0=normal, 1=medium, 2=large |
| textattr | int | Attribute flags (see below) |

**Text Attributes (can be combined with OR):**
| Value | Attribute |
|-------|-----------|
| 0 | Normal |
| 1 | Bold |
| 2 | Italic |
| 4 | Underlined |

**Example:**
```c
ftextout("Important!", 1, 5, 1, 3);  // Medium, bold+italic
```

### ftextclear(text, row, col, textsize, textattr)
Clears text previously output with ftextout.

```
ftextclear(in: string text, in: int row, in: int col, in: int textsize, in: int textattr)
```

### digitalout(val, row, col, trueText, falseText)
Displays a boolean as circle/dot with text.

```
digitalout(in: bool val, in: int row, in: int col, in: string TrueText, in: string FalseText)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| val | bool | Value to display |
| row | int | Row position |
| col | int | Column position |
| TrueText | string | Text for TRUE state |
| FalseText | string | Text for FALSE state |

**Display:** Circle for FALSE, filled dot for TRUE.

**Example:**
```c
digitalout(motor_running, 2, 30, " ON ", " OFF ");
```

### analogout(val, row, col, min, max, minValid, maxValid, format)
Displays a value as a bar graph.

```
analogout(in: real val, in: int row, in: int col, in: real min, in: real max,
          in: real minValid, in: real maxValid, in: string format)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| val | real | Value to display |
| row | int | Row position |
| col | int | Column position |
| min | real | Minimum display range |
| max | real | Maximum display range |
| minValid | real | Minimum valid value (green zone start) |
| maxValid | real | Maximum valid value (green zone end) |
| format | string | Number format "X.Y" or "" for default |

**Example:**
```c
analogout(voltage, 3, 30, 0.0, 15.0, 11.0, 14.5, "2.1");
```

### multianalogout(val, row, col, min, max, minValid, maxValid, format, mode)
Extended analog display with bar or triangle mode.

```
multianalogout(in: real val, in: int row, in: int col, in: real min, in: real max,
               in: real minValid, in: real maxValid, in: string format, in: int mode)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| mode | int | 1=triangle indicator, other=bar |

### hexdump(startAdr, numBytes, row, col)
Displays binary data as hex dump.

```
hexdump(in: string StartAdr, in: int numbytes, in: int row, in: int col)
```

### blankscreen()
Clears the current screen.

```
blankscreen()
```

### clearrect(row, col, height, width)
Clears a rectangular screen area.

```
clearrect(in: int row, in: int col, in: int height, in: int width)
```

### messagebox(title, text)
Displays a message box with exclamation icon.

```
messagebox(in: string Title, in: string Text)
```

### infobox(title, text)
Displays an info box with "i" icon.

```
infobox(in: string Title, in: string Text)
```

---

## UI Input Functions

### inputtext(text, boxTitle, boxText)
Text input dialog.

```
inputtext(out: string Text, in: string BoxTitle, in: string BoxText)
```

### inputint(val, boxTitle, boxText, minVal, maxVal)
Integer input with validation.

```
inputint(out: int val, in: string BoxTitle, in: string BoxText, 
         in: int minval, in: int maxval)
```

### inputnum(val, boxTitle, boxText, minVal, maxVal)
Numeric (real) input with validation.

```
inputnum(out: real val, in: string BoxTitle, in: string BoxText,
         in: real minval, in: real maxval)
```

### inputhex(hexStr, boxTitle, boxText, minHexStr, maxHexStr)
Hexadecimal input with validation.

```
inputhex(out: string hexstr, in: string BoxTitle, in: string BoxText,
         in: string MinHexStr, in: string MaxHexStr)
```

### inputdigital(val, boxTitle, boxText, falseStr, trueStr)
Boolean input dialog.

```
inputdigital(out: bool val, in: string BoxTitle, in: string BoxText,
             in: string FalseStr, in: string TrueStr)
```

### input2text(str1, str2, boxTitle, boxText, boxStr1, boxStr2)
Two text field input dialog.

```
input2text(out: string str1, out: string str2, in: string BoxTitle,
           in: string BoxText, in: string BoxStr1, in: string BoxStr2)
```

### input2int(val1, val2, boxTitle, boxText, boxStr1, boxStr2, min1, max1, min2, max2)
Two integer field input dialog.

```
input2int(out: int val1, out: int val2, in: string BoxTitle, in: string BoxText,
          in: string BoxStr1, in: string BoxStr2,
          in: int min1, in: int max1, in: int min2, in: int max2)
```

### input2hex(hexStr1, hexStr2, boxTitle, boxText, boxStr1, boxStr2, min1, max1, min2, max2)
Two hex field input dialog.

```
input2hex(out: string hexstr1, out: string hexstr2, in: string BoxTitle, in: string BoxText,
          in: string BoxStr1, in: string BoxStr2,
          in: string MinHexStr1, in: string MaxHexStr1,
          in: string MinHexStr2, in: string MaxHexStr2)
```

### input2hexnum(hexStr, num, boxTitle, boxText, boxStr1, boxStr2, minHex, maxHex, minNum, maxNum)
Combined hex and numeric input dialog.

```
input2hexnum(out: string hexstr, out: int num, in: string BoxTitle, in: string BoxText,
             in: string BoxStr1, in: string BoxStr2,
             in: string MinHexStr, in: string MaxHexStr,
             in: int minnum, in: int maxnum)
```

### getinputstate(inputState)
Gets the status of the last input dialog.

```
getinputstate(out: int InputState)
```

| Value | Meaning |
|-------|---------|
| 0 | Completed with OK |
| 1 | Cancelled |
| 2 | No input function called yet |

---

## Userbox Functions

Userboxes are overlay dialogs that can display information.

### userboxopen(boxNum, row, col, height, width, titleStr, textStr)
Opens a userbox.

```
userboxopen(in: int BoxNum, in: int row, in: int col, 
            in: int height, in: int width,
            in: string TitleStr, in: string TextStr)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| BoxNum | int | Box number 0-11 |
| row | int | Row position |
| col | int | Column position |
| height | int | Height in rows |
| width | int | Width in columns |
| TitleStr | string | Title (affects frame style) |
| TextStr | string | Initial text |

**Box Number Effects (with title):**
- 0-3: Bold frame
- 4-7: Normal frame
- 8-11: Normal frame (no frame without title)

### userboxclose(boxNum)
Closes a userbox.

```
userboxclose(in: int BoxNum)
```

### userboxclear(boxNum)
Clears userbox content.

```
userboxclear(in: int BoxNum)
```

### userboxftextout(boxNum, text, row, col, textsize, textattr)
Formatted text output in userbox.

```
userboxftextout(in: int BoxNum, in: string text, in: int row, in: int col,
                in: int textsize, in: int textattr)
```

**Additional text attributes for userbox:**
| Value | Attribute |
|-------|-----------|
| 8 | Vertically centered (row ignored) |
| 16 | Horizontally centered (col ignored) |

### userboxsetcolor(boxNum, fgColor, bgColor)
Sets userbox colors.

```
userboxsetcolor(in: int BoxNum, in: int FgColor, in: int BkColor)
```

---

## File Access Functions

### fileopen(fileName, openMode)
Opens a file.

```
fileopen(in: string FileName, in: string OpenMode)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| FileName | string | File path |
| OpenMode | string | "w"=write new, "a"=append, "r"=read |

### fileclose()
Closes the current file.

```
fileclose()
```

### filewrite(str)
Writes a line to the file (appends CRLF).

```
filewrite(in: string str)
```

### fileread(str, eof)
Reads a line from the file.

```
fileread(out: string str, out: bool EOF)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| str | string (out) | Line read |
| EOF | bool (out) | TRUE if end of file reached |

---

## File Viewer Functions

### viewopen(fileNameStr, titleStr)
Opens file in viewer.

```
viewopen(in: string FileNameStr, in: string TitleStr)
```

**Note:** In viewer, SHIFT+LINEDOWN/LINEUP navigates between errors.

### viewclose()
Closes the file viewer.

```
viewclose()
```

---

## String Functions

### strlen(len, str)
Gets string length.

```
strlen(out: int len, in: string str)
```

### strcat(destStr, srcStr1, srcStr2)
Concatenates two strings.

```
strcat(out: string DestStr, in: string SrcStr1, in: string SrcStr2)
```

### midstr(resultStr, srcStr, firstIndex, count)
Extracts a substring.

```
midstr(out: string ResultStr, in: string SrcStr, in: int FirstIndex, in: int Count)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ResultStr | string (out) | Extracted substring |
| SrcStr | string | Source string |
| FirstIndex | int | Start position (0-based) |
| Count | int | Number of characters |

**Example:**
```c
midstr(s, "Hello World", 0, 5);  // s = "Hello"
midstr(s, "Hello World", 6, 5);  // s = "World"
```

---

## String Array Functions

### StrArrayCreate(rc, hStrArray)
Creates a new string array.

```
StrArrayCreate(out: bool rc, out: int hStrArray)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| rc | bool (out) | TRUE if successful |
| hStrArray | int (out) | Handle to the array |

### StrArrayDestroy(hStrArray)
Destroys a string array and frees memory.

```
StrArrayDestroy(in: int hStrArray)
```

### StrArrayWrite(hStrArray, index, str)
Writes a string to the array.

```
StrArrayWrite(in: int hStrArray, in: int index, in: string str)
```

**Note:** Array grows dynamically to accommodate index.

### StrArrayRead(hStrArray, index, str)
Reads a string from the array.

```
StrArrayRead(in: int hStrArray, in: int index, out: string str)
```

### StrArrayGetElementCount(hStrArray, elementCount)
Gets number of elements in array.

```
StrArrayGetElementCount(in: int hStrArray, out: int ElementCount)
```

### StrArrayDelete(hStrArray)
Clears array content but keeps array alive.

```
StrArrayDelete(in: int hStrArray)
```

---

## Conversion Functions

### inttostring(i, s)
Converts integer to string.

```
inttostring(in: int i, out: string s)
```

### stringtoint(s, i)
Converts string to integer.

```
stringtoint(in: string s, out: int i)
```

**Supported formats:**
- Decimal: "123"
- Hex: "0x10" (max 4 digits)
- Binary: "0y11110101" (max 16 digits)
- Exponential: "010e2"

### realtostring(r, format, s)
Converts real to string with format.

```
realtostring(in: real r, in: string format, out: string s)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | "X.Y" where X=integer digits, Y=decimal digits |

### stringtoreal(s, r)
Converts string to real.

```
stringtoreal(in: string s, out: real r)
```

### inttoreal(i, r)
Converts integer to real.

```
inttoreal(in: int i, out: real r)
```

### realtoint(r, i)
Converts real to integer (truncates).

```
realtoint(in: real r, out: int i)
```

### bytetoint(inbyte, intout)
Converts byte to integer (preserves sign).

```
bytetoint(in: byte inbyte, out: int intout)
```

### inttolong(inint, longout)
Converts 16-bit int to 32-bit long.

```
inttolong(in: int inint, out: long longout)
```

### longtoreal(inlong, realout)
Converts 32-bit long to real.

```
longtoreal(in: long inlong, out: real realout)
```

### hexconvert(hexString, high, mid, low, seg)
Splits hex address into segment/bytes.

```
hexconvert(in: string HexString, out: int high, out: int mid, out: int low, out: int seg)
```

Formula: `HexString = seg * 0xFF000000 + high * 0x00FF0000 + mid * 0x0000FF00 + low * 0x000000FF`

---

## Timer Functions

### settimer(timerNum, timeVal)
Sets a timer.

```
settimer(in: int timernum, in: int timeval)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| timernum | int | Timer number |
| timeval | int | Duration in milliseconds |

### testtimer(timerNum, expiredFlag)
Checks if timer has expired.

```
testtimer(in: int timernum, out: bool expiredflag)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| expiredflag | bool (out) | TRUE if timer expired |

**Example:**
```c
settimer(0, 5000);  // 5 second timer
// ... later ...
testtimer(0, expired);
if (expired == TRUE) {
    // Timer finished
}
```

---

## Memory/Structure Functions

### CreateStructure(handle, length)
Creates a memory buffer.

```
CreateStructure(out: long handle, in: int length)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| handle | long (out) | Handle to buffer (actually address) |
| length | int | Size in bytes |

**Note:** Handle 0 is special - a global 32KB buffer shared across scripts.

### SetStructureMode(readWrite)
Sets access mode for subsequent operations.

```
SetStructureMode(in: int ReadWrite)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ReadWrite | int | 0=write mode, non-zero=read mode |

### StructureByte(handle, at, value)
Reads/writes a byte.

```
StructureByte(in: long handle, in: int at, inout: byte value)
```

### StructureInt(handle, at, value)
Reads/writes a 16-bit integer.

```
StructureInt(in: long handle, in: int at, inout: int value)
```

### StructureLong(handle, at, value)
Reads/writes a 32-bit integer.

```
StructureLong(in: long handle, in: int at, inout: long value)
```

### StructureString(handle, at, length, value)
Reads/writes a string.

```
StructureString(in: long handle, in: int at, in: int length, inout: string value)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| length | int | Max length (0=auto-detect) |

---

## Windows Interface Functions

### winhelp(helpfile)
Opens Windows help file.

```
winhelp(in: string helpfile)
```

### winhelpkey(helpfile, key)
Opens help file at specific keyword.

```
winhelpkey(in: string helpfile, in: string key)
```

### callwin(cmdline)
Executes a Windows command.

```
callwin(in: string cmdline)
```

**Example:**
```c
callwin("notepad.exe");
```

---

## PEM (Protocol/Label Manager) Functions

Functions for protocol and label printing.

### PEMInitialisiere(result, winEldiVersion, pruefstand, rechnerNr)
Initializes PEM.

```
PEMInitialisiere(out: bool Result, in: string WinEldiVersion, 
                 in: string Pruefstand, in: string RechnerNr)
```

### PEMLoad_formular(result, fileName, formularName)
Loads a form template.

```
PEMLoad_formular(out: bool Result, in: string FileName, in: string FormularName)
```

### PEMDefault_besetzen(result, formularName)
Sets all print fields to defaults.

```
PEMDefault_besetzen(out: bool Result, in: string FormularName)
```

### PEMWrite_druckfeld(result, druckfeldName, formularName, input)
Writes a value to a print field.

```
PEMWrite_druckfeld(out: bool Result, in: string DruckfeldName, 
                   in: string FormularName, in: string instring)
```

### PEMPrintFormular(result, formularName)
Prints the form.

```
PEMPrintFormular(out: bool Result, in: string FormularName)
```

### PEMForget_formular(result, formularName)
Unloads a form template.

```
PEMForget_formular(out: bool Result, in: string FormularName)
```

### PEMFree_mem(result)
Frees PEM memory.

```
PEMFree_mem(out: bool Result)
```

---

## Simulation Functions

### simnum(val, boxTitle, boxText)
Simulates analog variable input.

```
simnum(out: real val, in: string BoxTitle, in: string BoxText)
```

### simdigital(val, boxTitle, hexText, falseStr, trueStr)
Simulates digital variable input.

```
simdigital(out: bool val, in: string BoxTitle, in: string HexText,
           in: string FalseStr, in: string TrueStr)
```

---

## Additional BMW Library Functions (BMWLIB.H)

### instr(pos, ab, text, suchtext)
Finds substring position.

```
instr(out: int pos, in: int ab, in: string Text, in: string Suchtext)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| pos | int (out) | Position found (-1 if not found) |
| ab | int | Start position for search |
| Text | string | String to search in |
| Suchtext | string | String to search for |

### trimstr(text)
Removes leading/trailing whitespace.

```
trimstr(inout: string Text)
```

### bytetohexstring(zahl, laenge, text)
Converts byte to hex string.

```
bytetohexstring(in: byte zahl, in: int laenge, out: string text)
```

### inttohexstring(zahl, laenge, text)
Converts integer to hex string.

```
inttohexstring(in: int zahl, in: int laenge, out: string text)
```

### longtohexstring(zahl, laenge, text)
Converts long to hex string.

```
longtohexstring(in: long zahl, in: int laenge, out: string text)
```

### fileexist(fileName, errorCode)
Checks if file exists.

```
fileexist(in: string FileName, inout: int ErrorCode)
```

| Return | Meaning |
|--------|---------|
| 0 | File exists |
| other | DOS error code |

### filedelete(fileName, errorCode)
Deletes a file.

```
filedelete(in: string FileName, inout: int ErrorCode)
```

### GetPrivateProfileInt(section, entry, default, fileName)
Reads integer from INI file.

```
GetPrivateProfileInt(in: string Section, in: string Entry, 
                     in: int Default, in: string FileName, returns: int ReturnedValue)
```

### GetPrivateProfileString(section, entry, default, returnedString, size, fileName)
Reads string from INI file.

```
GetPrivateProfileString(in: string Section, in: string Entry, in: string Default,
                        out: string ReturnedString, in: int Size, in: string FileName,
                        returns: int ReturnedSize)
```

### WritePrivateProfileString(section, entry, string, fileName)
Writes string to INI file.

```
WritePrivateProfileString(in: string Section, in: string Entry, 
                          in: string String, in: string FileName,
                          returns: bool ReturnedValue)
```
