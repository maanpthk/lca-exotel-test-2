/** *******************************************************************************************************************
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
 ******************************************************************************************************************** */

const _ = require('lodash');
const qnabot = require('qnabot/logging');
const util = require('./util');
const lexRouter = require('./lexRouter');
const specialtyBotRouter = require('./specialtyBotRouter');
const esquery = require('../../../../../../../../../../opt/lib/query.js');

/**
 * This function identifies and invokes a lambda function that either queries opensearch for a
 * document to serve as an answer or will farm out to other alternate handling mechanisms (lambdas)
 * integrated via configured questions. There are two other alternate mechanisms at the present time.
 * One is quiz functionality and the second are specialty bots. Answers provided to questions from a
 * QnABot quiz are always directed to the quiz handler which is defined by the session attribute
 * queryLambda. Specialty Bots handle answering questions via a different bot. Specialty Bots are
 * configured in the question database with the keyword "specialty" as a prefix to the question id (qid).
 *
 * The three potential ARNs are identified first based on current state
 *
 * specialtyArn - indicates that a specialtyBot is active from the last input
 * specialtyBot - indicates botRouting is used to pass requests to either another LexBot or to third party Bot
 * queryLambdaArn - indicates that a quiz bot is active
 * arn - the default Arn to handle input
 *
 * Note that If a specialtyArn is available, this routine first checks to see if a different specialtyBot should
 * provide the answer and resets properties to use a new specialty Bot if one is identified via a local
 * query to the ES cluster.
 *
 * Now that the three Arns have been identified the following precedence is used
 * 1) queryLambda takes precedence and is used if defined.
 * 2) specialtyLambda has the next highest priority.
 * 3) default Lambda arn is used if neither queryLambda or specialtyLambda is present.
 *
 * @param req
 * @param res
 * @returns {Promise<any>}
 */

async function specialtyBotInvocation(req, res) {
    const specialtyBot = _.get(req, 'session.qnabotcontext.specialtyBot', undefined);
    const specialtyBotChainingConfig = _.get(req, 'session.qnabotcontext.sBChainingConfig', undefined);
    qnabot.log('Handling specialtyBot');
    const resp = await specialtyBotRouter.routeRequest(req, res, specialtyBot);
    qnabot.log(`SpecialtyBotRouterResp: ${JSON.stringify(resp, null, 2)}`);
    const isSpecialtyBotComplete = _.get(resp, 'res.session.qnabotcontext.specialtyBot', '') === '';
    if (isSpecialtyBotComplete) {
        // Specialty bot has completed. See if we need, to using chaining to go to another question
        if (specialtyBotChainingConfig) {
            qnabot.log(`Conditional chaining: ${specialtyBotChainingConfig}`);

            // Set session response bot attributes to force chaining to work properly in query.js
            _.set(res, 'session.qnabotcontext.elicitResponse.progress', 'Fulfilled');
            _.set(res, 'session.qnabotcontext.elicitResponse.chainingConfig', specialtyBotChainingConfig);
            // chainingConfig will be used in Query Lambda function
            // const arn = util.getLambdaArn(process.env.LAMBDA_DEFAULT_QUERY);
            const postQuery = await esquery(req, res);
            _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.progress', undefined);
            _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.chainingConfig', undefined);
            qnabot.log(`After chaining the following response is being made: ${JSON.stringify(postQuery, null, 2)}`);
            return postQuery;
        }
    }
    qnabot.log(`No chaining. The following response is being made: ${JSON.stringify(resp, null, 2)}`);
    return resp;
}

module.exports = async function query(req, res) {
    qnabot.debug('Entry REQ:', JSON.stringify(req, null, 2));
    qnabot.debug('Entry RES:', JSON.stringify(res, null, 2));

    /* These session variables may exist from a prior interaction with QnABot. They are
       used to control behavior of this function and divert the function away from the normal
       behavior of using an OpenSearch Query.

       - specialtyArn - calls to specialty bot for bot routing
       - queryLambdaArn - calls normally used by the quiz functionality
       - elicitResponse - indicates a lex bot should be used for processing
       - chainingConfig - from a prior elicitResponse based question. Used to conditionally
                          chain to another question when elicitResponse completes
     */
    const specialtyArn = _.get(req, 'session.specialtyLambda', undefined);
    const specialtyBot = _.get(req, 'session.qnabotcontext.specialtyBot', undefined);
    const queryLambdaArn = _.get(req, 'session.queryLambda', undefined);
    const elicitResponse = _.get(req, 'session.qnabotcontext.elicitResponse.responsebot', undefined);
    const chainingConfig = _.get(req, 'session.qnabotcontext.elicitResponse.chainingConfig', undefined);
    let arn;

    if (specialtyBot) {
        return specialtyBotInvocation(req, res);
    }

    if (elicitResponse) {
        qnabot.log('Handling elicitResponse');
        const resp = await lexRouter.elicitResponse(req, res, elicitResponse);
        const progress = _.get(resp, 'res.session.qnabotcontext.elicitResponse.progress', undefined);
        if (botIsFulfilled(progress)) {
            qnabot.log('Bot was fulfilled');
            // LexBot has completed. See if we need to using chaining to go to another question
            if (chainingConfig) {
                qnabot.log(`Conditional chaining: ${chainingConfig}`);
                // chainingConfig will be used in Query Lambda function
                arn = util.getLambdaArn(process.env.LAMBDA_DEFAULT_QUERY); // NOSONAR Intentions for arn not completely understood, may be needed for future implementations
                const postQuery = await esquery(req, res);

                // elicitResponse processing is done. Remove the flag for now.
                _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.progress', undefined);
                qnabot.log(`After chaining the following response is being made: ${JSON.stringify(postQuery, null, 2)}`);
                return postQuery;
            }
            // no chaining. continue on with response from standard fulfillment path.
            _.set(res, 'session.qnabotcontext.elicitResponse.progress', undefined);
        }
        qnabot.log(`No chaining. The following response is being made: ${JSON.stringify(resp, null, 2)}`);
        return resp;
    }

    arn = util.getLambdaArn(process.env.LAMBDA_DEFAULT_QUERY);  // NOSONAR Intentions for arn not completely understood, may be needed for future implementations
    if (specialtyArn) {
        const localEsQueryResults = await esquery(req, res);

        if (switchToNewBot(localEsQueryResults)) {
            /**
             * A number of session state attributes need to be removed as we switch away to another
             * specialty bot.
             */
            delete localEsQueryResults.res.session.brokerUID;
            delete localEsQueryResults.res.session.botAlias;
            delete localEsQueryResults.res.session.botName;
            delete localEsQueryResults.res.session.nohits;
            delete localEsQueryResults.res.session.specialtyLambda;
            return localEsQueryResults;
        }
    }
    const postQuery = await getPostQuery(queryLambdaArn, req, res, specialtyArn);

    qnabot.debug(`Standard path return from 3_query: ${JSON.stringify(postQuery, null, 2)}`);
    return postQuery;
};
async function getPostQuery(queryLambdaArn, req, res, specialtyArn) {
    let postQuery;
    if (queryLambdaArn) {
        postQuery = await util.invokeLambda({
            FunctionName: queryLambdaArn,
            req,
            res,
        });
    } else if (specialtyArn) {
        postQuery = await util.invokeLambda({
            FunctionName: specialtyArn,
            req,
            res,
        });
    } else {
        postQuery = await esquery(req, res);
    }

    /*
     After standard query look for elicitResponse or specialtyBot in the question being returned and set session attributes
     such that on next entry, response is sent to LexBot or specialtyBot.
     */
    const responsebot_hook = _.get(postQuery.res, 'result.elicitResponse.responsebot_hook', undefined);
    const responsebot_session_namespace = _.get(postQuery.res, 'result.elicitResponse.response_sessionattr_namespace', undefined);
    const chaining_configuration = _.get(postQuery.res, 'result.conditionalChaining', undefined);
    const specialtybot_hook = _.get(postQuery.res, 'result.botRouting.specialty_bot', undefined);
    const specialtybot_name = _.get(postQuery.res, 'result.botRouting.specialty_bot_name', undefined);
    const specialtybot_attributes_to_merge = _.get(postQuery.res, 'result.botRouting.specialty_bot_session_attributes_to_merge', undefined);
    const specialtybot_start_up_text = _.get(postQuery.res, 'result.botRouting.specialty_bot_start_up_text', undefined);
    const specialtybot_attributes_to_receive = _.get(postQuery.res, 'result.botRouting.specialty_bot_session_attributes_to_receive', undefined);
    const specialtybot_receive_namespace = _.get(postQuery.res, 'result.botRouting.specialty_bot_session_attributes_to_receive_namespace', undefined);
    if (responsebot_hook && responsebot_session_namespace) {
        if (_.get(postQuery, 'res.session.qnabotcontext.elicitResponse.loopCount')) {
            _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.loopCount', 0);
        }
        _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.responsebot', responsebot_hook);
        _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.namespace', responsebot_session_namespace);
        _.set(postQuery, 'res.session.qnabotcontext.elicitResponse.chainingConfig', chaining_configuration);
        _.set(postQuery.res.session, `${responsebot_session_namespace}.boterror`, undefined);
        _.set(postQuery.res.session, responsebot_session_namespace, {});
    } else if (specialtybot_hook && specialtybot_name) {
        _.set(postQuery, 'res.session.qnabotcontext.specialtyBot', specialtybot_hook);
        _.set(postQuery, 'res.session.qnabotcontext.specialtyBotName', specialtybot_name);
        _.set(postQuery, 'res.session.qnabotcontext.specialtyBotMergeAttributes', specialtybot_attributes_to_merge);
        _.set(postQuery, 'res.session.qnabotcontext.sBChainingConfig', chaining_configuration);
        _.set(postQuery, 'res.session.qnabotcontext.sBAttributesToReceive', specialtybot_attributes_to_receive);
        _.set(postQuery, 'res.session.qnabotcontext.sBAttributesToReceiveNamespace', specialtybot_receive_namespace);

        if (specialtybot_start_up_text) {
            _.set(postQuery, 'req.session.qnabotcontext.specialtyBot', specialtybot_hook);
            _.set(postQuery, 'req.session.qnabotcontext.specialtyBotName', specialtybot_name);
            _.set(postQuery, 'req.session.qnabotcontext.sBMergeAttributes', specialtybot_attributes_to_merge);
            _.set(postQuery, 'req.session.qnabotcontext.sBChainingConfig', chaining_configuration);
            _.set(postQuery, 'req.session.qnabotcontext.sBAttributesToReceive', specialtybot_attributes_to_receive);
            _.set(postQuery, 'req.session.qnabotcontext.sBAttributesToReceiveNamespace', specialtybot_receive_namespace);
            // eslint-disable-next-line no-template-curly-in-string
            if (specialtybot_start_up_text === '${utterance}') {
                _.set(postQuery, 'req.question', _.get(req, 'question'));
            } else {
                _.set(postQuery, 'req.question', specialtybot_start_up_text);
            }
            return specialtyBotInvocation(postQuery.req, postQuery.res);
        }
    }
    return postQuery;
}

function switchToNewBot(localEsQueryResults) {
    return localEsQueryResults.res.got_hits > 0 && localEsQueryResults.res.result.qid.startsWith('specialty')
        && (localEsQueryResults.req.session.botName
            !== localEsQueryResults.res.result.args[0]);
}

function botIsFulfilled(progress) {
    return progress === 'Fulfilled' || progress === 'ReadyForFulfillment' || progress === 'Close' || progress === 'Failed';
}

function specialtyBotIsComplete(resp) {
    return resp.res.session.specialtyBotProgress === 'Complete'
        || resp.res.session.specialtyBotProgress === 'Failed';
}
