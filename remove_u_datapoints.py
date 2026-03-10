#!/usr/bin/env python3
"""Remove rows with label 'U' from a CSV file."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def remove_label_rows(input_path: Path, output_path: Path, label_column: str, label_value: str) -> tuple[int, int]:
    rows_kept: list[dict[str, str]] = []

    with input_path.open("r", newline="") as infile:
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames
        if not fieldnames:
            raise ValueError(f"No header found in {input_path}")
        if label_column not in fieldnames:
            raise ValueError(f"Column '{label_column}' not found in {input_path}")

        total_rows = 0
        removed_rows = 0
        for row in reader:
            total_rows += 1
            if row.get(label_column, "").strip() == label_value:
                removed_rows += 1
                continue
            rows_kept.append(row)

    with output_path.open("w", newline="") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_kept)

    return total_rows, removed_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove rows with label 'U' from samples CSV.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/samples.csv"),
        help="Path to source CSV (default: data/samples.csv).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to output CSV. If omitted, updates input file in place.",
    )
    parser.add_argument(
        "--label-column",
        default="label",
        help="Column that contains class labels (default: label).",
    )
    parser.add_argument(
        "--label-value",
        default="U",
        help="Label value to remove (default: U).",
    )
    args = parser.parse_args()

    input_path = args.input
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if args.output is None:
        output_path = input_path.with_suffix(input_path.suffix + ".tmp")
        total_rows, removed_rows = remove_label_rows(
            input_path=input_path,
            output_path=output_path,
            label_column=args.label_column,
            label_value=args.label_value,
        )
        output_path.replace(input_path)
    else:
        output_path = args.output
        total_rows, removed_rows = remove_label_rows(
            input_path=input_path,
            output_path=output_path,
            label_column=args.label_column,
            label_value=args.label_value,
        )

    print(
        f"Processed {total_rows} rows. "
        f"Removed {removed_rows} rows where {args.label_column} == '{args.label_value}'."
    )


if __name__ == "__main__":
    main()
