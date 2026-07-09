# Regulatory Analysis

## HIPAA Certification Exploration
Anchor handles some user emotional states and session data. While currently designed as a wellness app, we aim to comply with HIPAA guidelines to ensure data privacy:
- **Data Encryption**: All database volumes are encrypted at rest. PII and sensitive text (`rsd_logs.trigger_text`) use AES-256-GCM.
- **Audit Logs**: The `AuditMiddleware` captures access to sensitive endpoints.
- **De-identification**: Data sent to AI providers (Claude, Gemini) is pseudonymized. No direct PHI is transmitted.
- **Access Control**: Principle of least privilege is planned for backend services and DB roles.
- **Next Steps**: Formal HIPAA risk assessment, signing BAAs with cloud providers (AWS/GCP), and engaging a third-party auditor.

## FDA Class II Digital Therapeutic Assessment
Anchor provides interventions for ADHD, anxiety, and focus challenges (e.g. Pomodoro, Breath Coach).
- Currently, Anchor operates under the FDA's "enforcement discretion" for low-risk general wellness products.
- If Anchor intends to claim it *treats* or *diagnoses* ADHD or clinical anxiety, it would be classified as a Software as a Medical Device (SaMD) and require 510(k) clearance.
- **Strategy**: Maintain positioning as a "wellness and productivity companion." Provide scientific backing for techniques (like Box Breathing or Pomodoro) without making specific clinical efficacy claims. Continue to monitor FDA guidance on digital therapeutics.

## Export & Account Deletion
Anchor fully complies with GDPR and CCPA regarding data subject rights:
- Users can export their data in JSON or CSV format.
- Account deletion can be scheduled (30-day retention) or executed immediately.
