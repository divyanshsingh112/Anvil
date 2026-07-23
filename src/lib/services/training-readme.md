# ML Model Retraining and Versioning Convention

This document outlines the versioning convention for machine learning models developed using the anonymized behavioral data snapshots in `TrainingDataSnapshot`.

## Model Versioning Convention
Models trained on snapshots accumulated in the database will be versioned using the pattern:
`[model-type]-v[integer]`

Examples:
* `momentum-v1`: The initial model predicting user momentum decay and shield requirements.
* `momentum-v2`: Retrained momentum model utilizing wider dataset variance.
* `difficulty-v1`: Model analyzing variance and active rates to auto-suggest difficulty tiers.
* `archetype-v1`: Model classifying user behavior archetypes.

## Retraining Workflow
1. **Accumulation**: Data accumulates daily in the `TrainingDataSnapshot` table from consenting users.
2. **Extraction**: snapshots are exported to cloud storage or queried directly for training inputs.
3. **Training**: Model training is performed manually in cloud notebooks (e.g. Google Colab / Jupyter) using Python libraries (Scikit-Learn, TensorFlow, or BigQuery ML).
4. **Deployment**: Retrained weights are integrated back into Anvil's prediction services, updating the active model version identifier.
