#!/usr/bin/env python3
"""Convenience launcher so the tool can be run as ``python main.py …``.

Delegates to :mod:`report_generator.main`.
"""
import sys

from report_generator.main import main

if __name__ == "__main__":
    sys.exit(main())
