//go:build !windows

package main

import (
	"os"
	"syscall"
)

// redirectStderr redirects stderr to the given file on Unix systems.
func redirectStderr(f *os.File) {
	_ = syscall.Dup2(int(f.Fd()), 2)
}
