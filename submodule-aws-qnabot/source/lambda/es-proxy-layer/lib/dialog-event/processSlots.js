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

function useCachedValue(slotName, slot_sessionAttrName, res, slotRequired, nextSlotToElicit) {
    qnabot.log(
        `Slot value caching enabled for: '${slotName}' using session attribute '${slot_sessionAttrName}'`,
    );
    const cachedValue = _.get(res.session, slot_sessionAttrName);
    if (cachedValue) {
        qnabot.log(`Filling slot ${slotName} using cached value: ${cachedValue}`);
        _.set(res, `slots.${slotName}`, cachedValue);
    } else {
        qnabot.log(`No cached value for slot ${slotName}`);
        _.set(res, `slots.${slotName}`, null);
        if (slotRequired && !nextSlotToElicit) {
            nextSlotToElicit = slotName;
        }
    }
    return [res, nextSlotToElicit];
}

function useSlotValue(slotName, slotValue, res, slotValueCached, slot_sessionAttrName) {
    qnabot.log(`Slot ${slotName} already filled: ${slotValue}`);
    _.set(res, `slots.${slotName}`, slotValue);
    if (slotValueCached) {
        qnabot.log(
            `Slot value caching enabled for: '${slotName}' setting session attribute '${slot_sessionAttrName}'`,
        );
        _.set(res.session, slot_sessionAttrName, slotValue);
    }

    return res;
}

function processSlots(req, res, hit) {
    const qid_slots = _.get(hit, 'slots');
    let nextSlotToElicit;

    if (!qid_slots) {
        return res;
    }

    for (const slot of qid_slots) {
        const slotName = _.get(slot, 'slotName');
        const slotValue = _.get(req, `slots.${slotName}`);
        const slotRequired = _.get(slot, 'slotRequired', false);
        const slotValueCached = _.get(slot, 'slotValueCached');
        const slot_sessionAttrName = `qnabotcontext.slot.${slotName}`;
        if (slotValue) {
            res = useSlotValue(slotName, slotValue, res, slotValueCached, slot_sessionAttrName);
        } else if (slotValueCached) {
            [res, nextSlotToElicit] = useCachedValue(slotName, slot_sessionAttrName, res, slotRequired, nextSlotToElicit);
        } else {
            qnabot.log(`Slot value caching is not enabled for: ${slotName}`);
            _.set(res, `slots.${slotName}`, null);
            if (slotRequired && !nextSlotToElicit) {
                nextSlotToElicit = slotName;
            }
        }
    }
    qnabot.log(`Set next slot to elicit: ${nextSlotToElicit}`);
    res.nextSlotToElicit = nextSlotToElicit;
    // Placeholder to add optional lambda hook for slot validation / runtime hints, etc. (future)
    return res;
}
exports.processSlots = processSlots;
