# ISSUE-0003: controlled example scores 99, not 100

Status: open; original 1.0 acceptance target.

Lighthouse 13.5.0 against the SSR/hydration component verification fixture reports 99/100 Performance, CLS 0, LCP 1.61 s, TBT 84 ms. The fixture also deliberately exercises broken-image and interaction paths. LCP discovery and unsized-image checks pass. Raw metrics are in bench/results/lighthouse.json; local full report is preserved in .local/lighthouse.html. Do not round 99 to 100 or remove functional tests to conceal this result. Remeasure a controlled representative page with a stable protocol before claiming the exact target.
