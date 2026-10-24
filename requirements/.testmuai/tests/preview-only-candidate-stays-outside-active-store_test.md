---
assurance:
  id: t-1
  base: sha256:4af74d2d9e856ece666245a72ee11e41864d8a4792f40a1bbff55359d5354c35
---
# Preview-only candidate stays outside active store

> With the confirmed candidate still in preview, observe that it is not activated in the active store, without pressing verification or activation controls.

## Step 1

At {{start_url}}, open LaunchGate's browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-9

At {{active_store_url}}, inspect the currently active store independently of the candidate preview, then assert the preview-only confirmed candidate has not been activated in the active store.
