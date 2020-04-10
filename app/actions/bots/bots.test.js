// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'assert';
import nock from 'nock';

import * as BotActions from '@actions/bots';
import {Client4} from '@mm-redux/client';

import TestHelper from 'test/test_helper';
import configureStore from 'test/test_store';

describe('Actions.Bots', () => {
    let store;
    beforeAll(async () => {
        await TestHelper.initBasic(Client4);
    });

    beforeEach(async () => {
        store = await configureStore();
    });

    afterAll(async () => {
        await TestHelper.tearDown();
    });

    it('loadBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            get(`/bots/${bot.user_id}`).
            query(true).
            reply(201, bot);

        await store.dispatch(BotActions.loadBot(bot.user_id));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        assert.equal(bot.username, botsResult.username);
    });
});
