/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const _ = require('lodash');
const qnabot = require('qnabot/logging');
const lex = require('./lex');
const alexa = require('./alexa');
const util = require('./util');
const {get_translation} = require('./multilanguage.js');

function sms_hint(req, res) {
    let hint = '';
    if (_.get(req, '_event.requestAttributes.x-amz-lex:channel-type') == 'Twilio-SMS') {
        if (_.get(req, '_settings.SMS_HINT_REMINDER_ENABLE')) {
            const interval_hrs = parseInt(_.get(req, '_settings.SMS_HINT_REMINDER_INTERVAL_HRS', 24));
            const hint_message = _.get(req, '_settings.SMS_HINT_REMINDER', '');
            const hours = req._userInfo.TimeSinceLastInteraction / 36e5;
            if (hours >= interval_hrs) {
                hint = hint_message;
                qnabot.log('Appending hint to SMS answer: ', hint);
            }
        }
    }
    return hint;
}

function split_message(message) {
    message = message.replace(/\n/g, ' ');
    const parts = message.split(/[\.\?\!](.+)/, 2); // split on first of these sentence terminators - '.?!'
    if (parts[1] == undefined) {
        parts[1] = '';
    }
    return parts;
}

async function connect_response(req, res) {
    // If QnABot is in multi language mode, translate NextPrompt into target language
    if (_.get(req._settings, 'ENABLE_MULTI_LANGUAGE_SUPPORT')) {
        const locale = _.get(req, 'session.qnabotcontext.userLocale');
        const nextPromptVarName = _.get(req, '_settings.CONNECT_NEXT_PROMPT_VARNAME', 'nextPrompt');
        let prompt = _.get(res.session, nextPromptVarName, '');
        if (prompt) {
            prompt = await get_translation(prompt, 'auto', locale, req);
        }
        _.set(res.session, nextPromptVarName, prompt);
    }
    // If in elicit response, set next prompt to empty
    if (_.get(res, 'session.qnabotcontext.elicitResponse.responsebot')) {
        const nextPromptVarName = _.get(req, '_settings.CONNECT_NEXT_PROMPT_VARNAME', 'nextPrompt');
        _.set(res.session, nextPromptVarName, '');
    }

    // Split multi-part sentences to enable barge in for long fulfillment messages when using Connect voice..
    // except when QnAbot is in ElicitResoonse mode.. in that case we keep the bot session with GetCustomerInput block open, so
    // the Connect contact flow loop is not invoked (and CONNECT_NEXT_PROMPT would not be played)
    if (req._clientType == 'LEX.AmazonConnect.Voice') {
        if (!_.get(res, 'session.qnabotcontext.elicitResponse.responsebot')) {
            // QnABot is not doing elicitResponse
            if (_.get(req, '_settings.CONNECT_ENABLE_VOICE_RESPONSE_INTERRUPT')) {
                const nextPromptVarName = _.get(req, '_settings.CONNECT_NEXT_PROMPT_VARNAME', 'nextPrompt');
                qnabot.log('CONNECT_ENABLE_VOICE_RESPONSE_INTERRUPT is true. splitting response.');
                // split multi sentence responses.. First sentence stays in response, remaining sentences get prepended to next prompt session attribute.
                let { message } = res;
                const prompt = _.get(res.session, nextPromptVarName, '').replace(/<speak>|<\/speak>/g, '');
                if (res.type == 'PlainText') {
                    // process plain text
                    const a = split_message(message); // split on first period
                    res.message = a[0];
                    _.set(res.session, nextPromptVarName, `${a[1]} ${prompt}`);
                } else if (res.type == 'SSML') {
                    // process SSML
                    // strip <speak> tags
                    message = message.replace(/<speak>|<\/speak>/g, '');
                    const a = split_message(message);
                    res.message = `<speak>${a[0]}</speak>`;
                    _.set(res.session, nextPromptVarName, `<speak>${a[1]} ${prompt}</speak>`);
                }
                qnabot.log('Response message:', res.message);
                qnabot.log('Reponse session var:', nextPromptVarName, ':', _.get(res.session, nextPromptVarName));
            }
        }
    }
    return res;
}

function resetAttributes(req, res) {
    // Kendra attributes
    const previous = _.get(req._event.sessionAttributes, 'previous');
    if (previous) {
        const obj = JSON.parse(previous);
        const prevQid = obj.qid;  // NOSONAR Need prevQid to reset attribute
    }
    const kendraResponsibleQid = _.get(res.session, 'qnabotcontext.kendra.kendraResponsibleQid');
    if ((res.result === undefined || res.result.qid === undefined) || (kendraResponsibleQid && (res.result.qid !== kendraResponsibleQid))) {
        // remove any prior session attributes for kendra as they are no longer valid
        _.unset(res, 'session.qnabotcontext.kendra.kendraQueryId');
        _.unset(res, 'session.qnabotcontext.kendra.kendraIndexId');
        _.unset(res, 'session.qnabotcontext.kendra.kendraResultId');
        _.unset(res, 'session.qnabotcontext.kendra.kendraResponsibleQid');
    }
}

module.exports = async function assemble(req, res) {
    try {
        if (process.env.LAMBDA_LOG) {
            await util.invokeLambda({
                FunctionName: process.env.LAMBDA_LOG,
                InvocationType: 'Event',
                req,
                res,
            });
        }

        if (process.env.LAMBDA_RESPONSE) {
            const result = await util.invokeLambda({
                FunctionName: process.env.LAMBDA_RESPONSE,
                InvocationType: 'RequestResponse',
                Payload: JSON.stringify(res),
            });

            _.merge(res, result);
        }

        // append hint to SMS message (if it's been a while since user last interacted)
        res.message += sms_hint(req, res);

        // enable interruptable bot response for Connect
        res = await connect_response(req, res);

        res.session = _.mapValues(
            _.get(res, 'session', {}),
            (x) => (_.isString(x) ? x : JSON.stringify(x)),
        );

        resetAttributes(req, res);
        switch (req._type) {
        case 'LEX':
            res.out = lex.assemble(req, res);
            break;
        case 'ALEXA':
            res.out = alexa.assemble(req, res);
            break;
        }

        return { req, res };
    } catch (error) {
        qnabot.log('An error occured in assemble: ', error);
        throw error
    }
};
