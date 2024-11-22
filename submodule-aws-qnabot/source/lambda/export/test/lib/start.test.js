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

const start = require('../../lib/start');
const load = require('../../lib/load');
jest.mock('../../lib/load');

describe('test start function', () => {
    
    jest.mock('../../lib/start', () => ({
        query: jest.fn(),
    }));

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should start and invoke load function when filter is not null', async () => {

        require('../../lib/start').query.mockReturnValue({
            size: 1000,
            _source: {
                exclude: ['questions.q_vector', 'a_vector', 'passage_vector'],
            },
            query: {
                bool: {
                    must: { match_all: {} },
                    filter: {
                        regexp: {
                            qid: 'filter',
                        },
                    },
                },
            },
        });

        load.mockResolvedValue({ sample: 'response' });
        const config = {
            index: 'index',
            filter: 'filter',
            status: 'status',
            startDate: 'startDate',
            parts: ['part']
        };
        const expectedConfig = {
            bucket: 'contentdesigneroutputbucket',
            index: 'index',
            filter: 'filter',
            status: 'InProgress',
            startDate: expect.any(String),
            parts: [],
        };
        await start(config);
        expect(load).toHaveBeenCalledWith(expectedConfig, {
            endpoint: process.env.ENDPOINT,
            method: 'POST',
            path: `${config.index}/_search?scroll=1m`,
            body: require('../../lib/start').query(),
        });
    })

    it('should start and invoke load function when filter is null', async () => {

        const config = {
            index: 'index',
            filter: null,
            status: 'status',
            startDate: 'startDate',
            parts: ['part']
        };
        const expectedConfig = {
            bucket: 'contentdesigneroutputbucket',
            index: 'index',
            filter: null,
            status: 'InProgress',
            startDate: expect.any(String),
            parts: [],
        };
        require('../../lib/start').query.mockReturnValue({
            size: 1000,
            _source: {
                exclude: ['questions.q_vector', 'a_vector', 'passage_vector'],
            },
            query: {
                bool: {
                    must: { match_all: {} },
                },
            },
        });

        load.mockResolvedValue({ sample: 'response' });
        await start(config);
        expect(load).toHaveBeenCalledWith(expectedConfig, {
            endpoint: process.env.ENDPOINT,
            method: 'POST',
            path: `${config.index}/_search?scroll=1m`,
            body: require('../../lib/start').query(),
        });
    })

    it('should response with error if load function fails', async () => {

        const config = {
            index: 'index',
            filter: 'filter',
            status: 'status',
            startDate: 'startDate',
            parts: ['part']
        }
        const expected = new Error('load function error');
        load.mockRejectedValue(expected);
        await expect(start(config)).rejects.toEqual(expected);
    })
})