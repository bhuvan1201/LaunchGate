---
mode: testing
max_steps: 50
target: chrome
variables:
  global.start_url:
    value: http://127.0.0.1:4173
    secret: false
    syntax: '{{start_url}}'
    type: global
---

# Session: launchgate_openai_candidate_setup

## Step 1
Open LaunchGate. Replace the promotion brief with: Name this promotion Welcome 20. Give new customers 20% off when eligible merchandise reaches $42, cap the discount at $10, and exclude sale items. Click Interpret with OpenAI. Verify the page says OpenAI interpreted the request and the editable policy shows title Welcome 20, discount 20%, minimum eligible subtotal $42.00, maximum discount $10.00, New customers only checked, and Exclude sale items checked. Then click Confirm candidate and verify Candidate preview #1 shows Welcome 20 and the launch gate says this candidate needs a passing Kane run. Do not click Run Kane verification or Activate verified revision.
