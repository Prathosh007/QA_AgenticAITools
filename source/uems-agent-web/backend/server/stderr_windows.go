//go:build windows

package main

import (
	"os"

	"golang.org/x/sys/windows"
)

// redirectStderr redirects stderr to the given file on Windows.
func redirectStderr(f *os.File) {
	_ = windows.SetStdHandle(windows.STD_ERROR_HANDLE, windows.Handle(f.Fd()))
}
