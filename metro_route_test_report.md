# Namma Metro — Route & Simulation Test Report

**Generated:** 13/5/2026, 11:45:40 am

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 134 |
| ✅ Passed | 134 |
| ❌ Failed | 0 |
| Pass Rate | **100.0%** |

## Group 1: Frequency & Schedule (12/12)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 1 | Purple Line peak freq at 8:00 | ✅ | — |
| 2 | Purple Line peak freq at 9:00 | ✅ | — |
| 3 | Purple Line off-peak freq at 6:00 | ✅ | — |
| 4 | Purple Line off-peak freq at 7:00 | ✅ | — |
| 5 | Green Line peak freq at 8:00 | ✅ | — |
| 6 | Green Line peak freq at 9:00 | ✅ | — |
| 7 | Green Line off-peak freq at 6:00 | ✅ | — |
| 8 | Green Line off-peak freq at 7:00 | ✅ | — |
| 5 | Service starts at 05:00 (no trains before) | ✅ | — |
| 6 | Service active at 05:00 | ✅ | — |
| 7 | Service ends at 23:00 | ✅ | — |
| 8 | Service active at 22:59 | ✅ | — |

## Group 2: Active Train Counts (8/8)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 9 | Yellow Line peak freq at 8:00 | ✅ | — |
| 10 | Yellow Line peak freq at 9:00 | ✅ | — |
| 11 | Yellow Line off-peak freq at 6:00 | ✅ | — |
| 12 | Yellow Line off-peak freq at 7:00 | ✅ | — |
| 17 | Purple Line has reasonable train count at noon | ✅ | — |
| 18 | Purple Line has forward trains at noon | ✅ | 4 forward |
| 19 | Purple Line has reverse trains at noon | ✅ | 5 reverse |
| 20 | Green Line has reasonable train count at noon | ✅ | — |

## Group 3: Train Position Validity (25/25)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 21 | Green Line has forward trains at noon | ✅ | 5 forward |
| 22 | Green Line has reverse trains at noon | ✅ | 6 reverse |
| 23 | Yellow Line has reasonable train count at noon | ✅ | — |
| 24 | Yellow Line has forward trains at noon | ✅ | 3 forward |
| 25 | Yellow Line has reverse trains at noon | ✅ | 2 reverse |
| 21 | Purple Line train 0 fromIdx valid | ✅ | — |
| 22 | Purple Line train 0 progress in [0,1] | ✅ | — |
| 23 | Purple Line train 0 direction valid | ✅ | reverse |
| 24 | Purple Line train 1 fromIdx valid | ✅ | — |
| 25 | Purple Line train 1 progress in [0,1] | ✅ | — |
| 26 | Purple Line train 1 direction valid | ✅ | reverse |
| 27 | Purple Line train 0 fromIdx valid | ✅ | — |
| 28 | Purple Line train 0 progress in [0,1] | ✅ | — |
| 29 | Purple Line train 0 direction valid | ✅ | reverse |
| 30 | Purple Line train 1 fromIdx valid | ✅ | — |
| 31 | Purple Line train 1 progress in [0,1] | ✅ | — |
| 32 | Purple Line train 1 direction valid | ✅ | reverse |
| 33 | Green Line train 0 fromIdx valid | ✅ | — |
| 34 | Green Line train 0 progress in [0,1] | ✅ | — |
| 35 | Green Line train 0 direction valid | ✅ | forward |
| 36 | Green Line train 1 fromIdx valid | ✅ | — |
| 37 | Green Line train 1 progress in [0,1] | ✅ | — |
| 38 | Green Line train 1 direction valid | ✅ | reverse |
| 39 | Green Line train 0 fromIdx valid | ✅ | — |
| 40 | Green Line train 0 progress in [0,1] | ✅ | — |

## Group 4: Leave-By Planner (16/16)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 41 | Green Line train 0 direction valid | ✅ | reverse |
| 42 | Green Line train 1 fromIdx valid | ✅ | — |
| 43 | Green Line train 1 progress in [0,1] | ✅ | — |
| 44 | Green Line train 1 direction valid | ✅ | forward |
| 45 | Yellow Line train 0 fromIdx valid | ✅ | — |
| 46 | Yellow Line train 0 progress in [0,1] | ✅ | — |
| 47 | Yellow Line train 0 direction valid | ✅ | reverse |
| 48 | Yellow Line train 1 fromIdx valid | ✅ | — |
| 49 | Yellow Line train 1 progress in [0,1] | ✅ | — |
| 50 | Yellow Line train 1 direction valid | ✅ | forward |
| 51 | Yellow Line train 0 fromIdx valid | ✅ | — |
| 52 | Yellow Line train 0 progress in [0,1] | ✅ | — |
| 53 | Yellow Line train 0 direction valid | ✅ | forward |
| 54 | Yellow Line train 1 fromIdx valid | ✅ | — |
| 55 | Yellow Line train 1 progress in [0,1] | ✅ | — |
| 56 | Yellow Line train 1 direction valid | ✅ | forward |

## Group 5: Station Data Integrity (29/29)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 62 | LB: minsUntilNext > 0 — Purple peak, walk 5 | ✅ | — |
| 63 | LB: leaveInSec is finite — Purple peak, walk 5 | ✅ | 60s |
| 64 | LB: canMakeIt is boolean — Purple peak, walk 5 | ✅ | — |
| 65 | LB: can make train if walk < freq — Purple peak, walk 5 | ✅ | — |
| 66 | LB: minsUntilNext > 0 — Purple peak, walk 3, mid-cycle | ✅ | — |
| 67 | LB: leaveInSec is finite — Purple peak, walk 3, mid-cycle | ✅ | 0s |
| 68 | LB: canMakeIt is boolean — Purple peak, walk 3, mid-cycle | ✅ | — |
| 69 | LB: can make train if walk < freq — Purple peak, walk 3, mid-cycle | ✅ | — |
| 70 | LB: minsUntilNext > 0 — Green off-peak, walk 8 | ✅ | — |
| 71 | LB: leaveInSec is finite — Green off-peak, walk 8 | ✅ | 240s |
| 72 | LB: canMakeIt is boolean — Green off-peak, walk 8 | ✅ | — |
| 73 | LB: minsUntilNext > 0 — Yellow peak, walk 6 | ✅ | — |
| 74 | LB: leaveInSec is finite — Yellow peak, walk 6 | ✅ | 240s |
| 75 | LB: canMakeIt is boolean — Yellow peak, walk 6 | ✅ | — |
| 61 | Purple Line has ≥5 stations | ✅ | 19 stations |
| 62 | Purple Line has no duplicate station names | ✅ | — |
| 63 | Purple Line terminus A defined | ✅ | Baiyappanahalli |
| 64 | Purple Line terminus B defined | ✅ | — |
| 65 | Purple Line peak freq < off-peak freq | ✅ | 6 vs 10 |
| 66 | Green Line has ≥5 stations | ✅ | 28 stations |
| 67 | Green Line has no duplicate station names | ✅ | — |
| 68 | Green Line terminus A defined | ✅ | Nagasandra |
| 69 | Green Line terminus B defined | ✅ | — |
| 70 | Green Line peak freq < off-peak freq | ✅ | 8 vs 12 |
| 71 | Yellow Line has ≥5 stations | ✅ | 17 stations |
| 72 | Yellow Line has no duplicate station names | ✅ | — |
| 73 | Yellow Line terminus A defined | ✅ | RV Road |
| 74 | Yellow Line terminus B defined | ✅ | — |
| 75 | Yellow Line peak freq < off-peak freq | ✅ | 10 vs 15 |

## Group 6: Multi-Line Concurrent (10/10)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 76 | LB: can make train if walk < freq — Yellow peak, walk 6 | ✅ | — |
| 77 | LB: minsUntilNext > 0 — Late service, walk 3 | ✅ | — |
| 78 | LB: leaveInSec is finite — Late service, walk 3 | ✅ | 420s |
| 79 | LB: canMakeIt is boolean — Late service, walk 3 | ✅ | — |
| 80 | LB: can make train if walk < freq — Late service, walk 3 | ✅ | — |
| 81 | LB: minsUntilNext > 0 — Walk longer than gap — miss train | ✅ | — |
| 82 | LB: leaveInSec is finite — Walk longer than gap — miss train | ✅ | -780s |
| 83 | LB: canMakeIt is boolean — Walk longer than gap — miss train | ✅ | — |
| 84 | LB: minsUntilNext > 0 — Just before peak ends | ✅ | — |
| 85 | LB: leaveInSec is finite — Just before peak ends | ✅ | 180s |

## Group 7: Peak vs Off-Peak (8/8)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 86 | LB: canMakeIt is boolean — Just before peak ends | ✅ | — |
| 87 | LB: can make train if walk < freq — Just before peak ends | ✅ | — |
| 88 | LB: minsUntilNext > 0 — Off-peak, very short walk | ✅ | — |
| 89 | LB: leaveInSec is finite — Off-peak, very short walk | ✅ | 540s |
| 90 | LB: canMakeIt is boolean — Off-peak, very short walk | ✅ | — |
| 91 | LB: can make train if walk < freq — Off-peak, very short walk | ✅ | — |
| 92 | LB: minsUntilNext > 0 — Evening peak, walk 10 | ✅ | — |
| 93 | LB: leaveInSec is finite — Evening peak, walk 10 | ✅ | -120s |

## Group 8: Edge Cases (26/26)

| # | Test | Status | Detail |
|---|------|--------|--------|
| 94 | LB: canMakeIt is boolean — Evening peak, walk 10 | ✅ | — |
| 95 | LB: minsUntilNext > 0 — Early morning, walk 4 | ✅ | — |
| 96 | LB: leaveInSec is finite — Early morning, walk 4 | ✅ | 660s |
| 97 | LB: canMakeIt is boolean — Early morning, walk 4 | ✅ | — |
| 98 | LB: can make train if walk < freq — Early morning, walk 4 | ✅ | — |
| 114 | All lines produce trains at 7:00 | ✅ | 25 total trains |
| 115 | Purple Line train count sane at 7:00 | ✅ | — |
| 116 | Green Line train count sane at 7:00 | ✅ | — |
| 117 | Yellow Line train count sane at 7:00 | ✅ | — |
| 118 | All lines produce trains at 12:00 | ✅ | 25 total trains |
| 119 | Purple Line train count sane at 12:00 | ✅ | — |
| 120 | Green Line train count sane at 12:00 | ✅ | — |
| 121 | Yellow Line train count sane at 12:00 | ✅ | — |
| 122 | All lines produce trains at 18:00 | ✅ | 38 total trains |
| 123 | Purple Line train count sane at 18:00 | ✅ | — |
| 124 | Green Line train count sane at 18:00 | ✅ | — |
| 125 | Yellow Line train count sane at 18:00 | ✅ | — |
| 126 | Purple Line has more/equal trains at peak vs off-peak | ✅ | peak: 14, off: 9 |
| 127 | Green Line has more/equal trains at peak vs off-peak | ✅ | peak: 16, off: 11 |
| 128 | Yellow Line has more/equal trains at peak vs off-peak | ✅ | peak: 8, off: 5 |
| 129 | No trains at midnight | ✅ | — |
| 130 | No trains at 4:59 AM | ✅ | — |
| 131 | Trains at exactly 5:00 AM | ✅ | — |
| 132 | Trains at 22:58 | ✅ | — |
| 133 | No trains at 23:01 | ✅ | — |
| 134 | Walk=0 leave-by is always makeable at peak | ✅ | 360s to spare |

