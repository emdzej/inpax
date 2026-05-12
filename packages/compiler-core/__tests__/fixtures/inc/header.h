// Test header — pulled in via #include.
//
// Declares a global and an `extern` prototype (the latter is ignored by
// the compiler since system functions come from a hardcoded table; we
// only need to make sure the parser doesn't choke on it).

int from_header_counter;

extern delay(in: int ms);
