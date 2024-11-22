# Personally Identifiable Information (PII) Rejection and Redaction

QnABot can now detect and redact Personally Identifiable Information (PII) using [Amazon Comprehend](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html) and regular expressions.

If ENABLE_REDACTING is set to "true", the Comprehend detected PII entities will also be redacted from Amazon CloudWatch logs and Amazon Opensearch logs.

![settings image](./images/settings.png)

|Setting | Type of Value | Description |
--------|---------------|-------------|
| ENABLE_REDACTING | true or false | Enable the system to redact log output
| REDACTING_REGEX | regex expression | Redacts expressions matching regex from logs
| ENABLE_REDACTING_WITH_COMPREHEND | true or false | Enables [Amazon Comprehend based PII Redacting](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/)
| COMPREHEND_REDACTING_CONFIDENCE_SCORE | number (0 to 0.99) | Only redact PII where Amazon Comprehend's confidence score is greater than this number
| COMPREHEND_REDACTING_ENTITY_TYPES | comma separated list of [PII Entity Categories](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/) | Only recognize PII entity types in the list for redaction
| PII_REJECTION_ENABLED | true or false | Enables PII Rejection
| PII_REJECTION_QUESTION | text  | If PII is found, the user's request (question) will change to this phrase
| PII_REJECTION_CONFIDENCE_SCORE | number (0 to 0.99) | Only reject PII where Amazon Comprehend's confidence score is greater than this number
| PII_REJECTION_REGEX | regex expression | Used to find PII based on a regex
| PII_REJECTION_ENTITY_TYPES | comma separated list of [PII Entity Categories](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/) | Only recognize PII entity types in the list
| DISABLE_CLOUDWATCH_LOGGING | true or false | Disable all logging in fulfillment es query handler lambda. does not disable logging from Lambda Hooks or Conditional Chaining Lambda functions

# Optional Redact feature for log and metric output

QnABot can be configured to redact information written to CloudWatch logs, S3 metrics, and OpenSearch Dashboards metrics logs.
This feature is disabled by default. Use the Designer UI Settings form to enable this feature. One can configure
the RegEx applied to strings as they are logged. If RegEx matches are found, the match is replaced with the string
'XXXXXX'.

The initial RegEx is

```regex
\b\d{4}\b(?![-])|\b\d{9}\b|\b\d{3}-\d{2}-\d{4}\b
```

This replaces 4 digit numbers not followed by a hyphen, a 9 digit number (SSN without hyphens), and a typical
SSN using nnn-nn-nnnn syntax with hyphens.