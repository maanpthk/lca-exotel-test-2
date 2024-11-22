# MultiLanguage Support

QnABot supports both voice and text interactions in multiple languages. QnABot can detect the predominant language in an interaction by using Amazon Comprehend, a natural language processing (NLP) service that uses machine learning to find insights and relationships in text. The bot then uses Amazon Translate, a neural machine translation service to convert questions and answers across languages from a single shared set of FAQs and documents.

By default the multi language feature is disabled. QnABot uses a property named `ENABLE_MULTI_LANGUAGE_SUPPORT`, default value of `false`. You can change this setting using the Content Designer Settings page. Set it to `true` to enable multi language support.

QnABot converts the question posed by the user to English, using Amazon Translate, and performs a lookup of the answer in  Amazon OpenSearch Service (successor to Amazon Elasticsearch Service) just as it normally does, using the English translation of the question. Searches are done in English only since QnABot documents are indexed using the English text analyzer (stemming, stop words, etc.)
Once it finds the question, QnABot will serve up the configured answer.

You can also import the sample or extension named Language / Multiple Language Support from the QnABot Import menu option.
This adds two questions to the system: Language.000 and Language.001. The first question allows the end user to set their preferred language explicitly; the latter resets the preferred language and allow QnABot to choose the locale based on the automatically detected predominant language.


## Using Voice to interact
When deploying the AWS QnABot solution (version 4.7.0 and higher) CloudFormation template, you will see a parameter `LexV2BotLocaleIds`. This parameter is used to support users to interact with the bot using voice in the configured languages.

`LexV2BotLocaleIds` — enter one or more of the language codes (with multiple values separated by comma without any spaces. Such as: en_US,es_US,es_ES,fr_FR). For a list of supported languages, see [Supported Languages](#supported-languages) section below.

QnABot can automatically generate additional Automatic Speech Recognition (ASR) training data for Amazon Lex using questions from all the items you have added. QnABot also automatically generates LexV2 ASR training data in multiple languages using Amazon Translate, for each LexV2 locale specified during installation. In addition to this out-of-the-box capability, you can also further improve and fine-tune ASR accuracy, by creating your own language specific questions into the Content Designer.
Once you have added the language specific questions, choose `LEX REBUILD` from the top right edit card menu. This will re-train Amazon Lex using the newly added questions as training data.


## Setting up alternate curated answers in a different language
If you do not explicitly define an answer in the user's language, QnABot will automatically use Amazon Translate to convert the default English. answer to the target language.
However, you might need to provide a more natural experience and want to add a curated answer in the native language of your choice. To further customize the translation for each question, you can use the {{handlebar}} functionality. QnABot provides the {{handlebar}} function `ifLang`, which takes the locale as a quoted parameter. For a list of supported languages, see [Supported Languages](#supported-languages) section below.

For example, to customize the translation in Spanish, the ifLang function uses es as the locale parameter.
```
{{#ifLang 'es'}}
          Su traducción al español
{{/ifLang}}

Additionally, if an unknown language is detected, you can support that with a default response by using the defaultLang function.

{{#defaultLang}}
          Your default language answer
{{/defaultLang}}
```



For additional information, take a look at our blog post on [Building a multilingual question and answer bot with Amazon Lex](https://aws.amazon.com/blogs/machine-learning/building-a-multilingual-question-and-answer-bot-with-amazon-lex/)





## Supported Languages

### Using Voice for interaction
(one or more of the below codes can be used in the `LexV2BotLocaleIds` Cloudformation parameter. Separate multiple values by comma without any spaces. Such as: `en_US,es_US,es_ES,fr_FR`)

|Code   |Language and locale                 |
|-------|------------------------------------|
|ar_AE  |Gulf Arabic (United Arab Emirates)* |
|de_AT  |German (Austria)                    |
|de_DE  |German (Germany)                    |
|en_AU  |English (Australia)                 |
|en_GB  |English (UK)                        |
|en_IN  |English (India)                     |
|en_US  |English (US)                        |
|en_ZA  |English (South Africa)              |
|es_419 |Spanish (Latin America)             |
|es_ES  |Spanish (Spain)                     |
|es_US  |Spanish (US)                        |
|fi_FI  |Finnish (Finland)*                  |
|fr_CA  |French (Canada)                     |
|fr_FR  |French (France)                     |
|hi_IN  |Hindi (India)*                      |
|it_IT  |Italian (Italy)                     |
|ja_JP  |Japanese (Japan)                    |
|ko_KR  |Korean (Korea)                      |
|nl_NL  |Dutch (Netherlands)*                |
|no_NO  |Norwegian (Norway)*                 |
|pl_PL  |Polish (Poland)*                    |
|pt_BR  |Portuguese (Brazil)*                |
|pt_PT  |Portuguese (Portugal)*              |
|sv_SE  |Swedish (Sweden)*                   |
|zh_CN  |Mandarin (PRC)*                     |
|zh_HK  |Cantonese (HK)*                     |


`* Language and locale not available in Asia Pacific (Singapore) (ap-southeast-1) and Africa (Cape Town) (ap-south-1) AWS regions`


### Using Text for interaction
When using text for interacting with the Bot, the following languages are supported.
These language codes can also be used via the handlebar functionality.

|Language              |Language Code|
|----------------------|-------------|
|Afrikaans             |af           |
|Albanian              |sq           |
|Amharic               |am           |
|Arabic                |ar           |
|Armenian              |hy           |
|Azerbaijani           |az           |
|Bengali               |bn           |
|Bosnian               |bs           |
|Bulgarian             |bg           |
|Catalan               |ca           |
|Chinese               |zh           |
|Chinese (Simplified)  |zh           |
|Chinese (Traditional) |zh-TW        |
|Creole                |ht           |
|Croatian              |hr           |
|Czech                 |cs           |
|Danish                |da           |
|Dari                  |fa-AF        |
|Dutch                 |nl           |
|English               |en           |
|Estonian              |et           |
|Farsi (Persian)       |fa           |
|Filipino, Tagalog     |tl           |
|Finnish               |fi           |
|French                |fr           |
|French (Canada)       |fr-CA        |
|Georgian              |ka           |
|German                |de           |
|Greek                 |el           |
|Gujarati              |gu           |
|Haitian Creole        |ht           |
|Hausa                 |ha           |
|Hebrew                |he           |
|Hindi                 |hi           |
|Hungarian             |hu           |
|Icelandic             |is           |
|Indonesian            |id           |
|Irish                 |ga           |
|Italian               |it           |
|Japanese              |ja           |
|Kannada               |kn           |
|Kazakh                |kk           |
|Korean                |ko           |
|Latvian               |lv           |
|Lithuanian            |lt           |
|Macedonian            |mk           |
|Malay                 |ms           |
|Malayalam             |ml           |
|Maltese               |mt           |
|Marathi               |mr           |
|Mongolian             |mn           |
|Norwegian             |no           |
|Pashto                |ps           |
|Persian               |fa           |
|Polish                |pl           |
|Portuguese            |pt           |
|Portuguese (Portugal) |pt-PT        |
|Punjabi               |pa           |
|Romanian              |ro           |
|Russian               |ru           |
|Serbian               |sr           |
|Sinhala               |si           |
|Slovak                |sk           |
|Slovenian             |sl           |
|Somali                |so           |
|Spanish               |es           |
|Spanish (Mexico)      |es-MX        |
|Swahili               |sw           |
|Swedish               |sv           |
|Tagalog               |tl           |
|Tamil                 |ta           |
|Telugu                |te           |
|Thai                  |th           |
|Turkish               |tr           |
|Ukrainian             |uk           |
|Urdu                  |ur           |
|Uzbek                 |uz           |
|Vietnamese            |vi           |
|Welsh                 |cy           |


# Core Language Support
When deploying the AWS QnABot solution (version 5.5.0 and higher) CloudFormation template, you will see a parameter `Language` in which you have the option of selecting one of the 33 languages. This Language parameter is used as the core Language for your QnABot deployment. The Language Analyzer for your Opensearch index setting will use the Language that you have specified in this parameter. In the case that your input has a low confidence rate it will default to English as that is the Backup Language that will be used. 

Some other Information about the addition:
- Custom Terminology will also support your Native Language
- For the SageMaker LLM, Llama-2-13b-chat is supported in English. If you wish to use the multi-language feature with an LLM, we encourage you to use Bedrock with a model that can support other languages. If you are using a language other than English as your core language, then make sure to change your LLM Prompt settings to match your core Language. If your preferred core Language is not supported by any Bedrock model, then you will need to use your own lambda and LLM. 
- For the embeddings, intfloat/e5-large-v2 model only supports English, If you are using a non-English Native language then you should use your own embeddings model and provide the Lambda in your deployment.
- If using the Thumbs up and down feature, you should translate Thumbs up and down into your native language and put that phrase in the PROTECTED_UTTERANCES setting. This is to prevent that to be treated as a question by the qnabot. to do this you can do the following steps:

    1. Use the AWS translate API to translate Thumbs up and Thumbs down to your deployment Language if it is not English

    2. Add the translation of Thumbs up and down in the website client config inside your qnabot code and deploy 

    3. Add the translation of the Thumbs up and down as a question in your QnABot deployment

    4. Go to the content designer and click on the top left and click on settings 

    5. Find the PROTECTED_UTTERANCES variable and insert that phrase in by adding a `,` and then enter in the translation

- PII redaction will still be for Engish as that is still accurate with other languages 

- Changing the NATIVE_LANGUAGE should always be done from the Cloudformation Stack by changing the `Language` Parameter

When creating a Kendra Web Crawling Data Source from the QnABot UI, it will be created in the native language specified in your CloudFormation (CFN) parameters. If the specified native language is not supported by Kendra, English will be used as the default language.

When querying within your Kendra Data Source, the following logic will be applied to determine the language used for querying:

1. The algorithm will determine the user's locale and use the `shouldUseOriginalLanguageQuery()` function to decide whether to query in the native language or the user's locale language.
2. Based on the result from `shouldUseOriginalLanguageQuery()`, it will either:
   - Use the locale's language if it is supported by Kendra.
   - If the locale's language is not supported, it will check if the native language (the language chosen in the CFN parameters) is supported by Kendra.
3. If neither the locale's language nor the native language is supported by Kendra, English will be used as the default language for querying.

In summary, the algorithm tries to use the user's preferred language (either the locale or the native language specified in the CFN parameters) if it is supported by Kendra. If neither language is supported, English is used as the fallback language for querying the Kendra Data Source.
