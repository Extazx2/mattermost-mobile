// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mm-redux/client';
import {BotTypes} from '@mm-redux/action_types';
import {bindClientFunc} from '@mm-redux/actions/helpers';

import {ActionFunc} from '@mm-redux/types/actions';

export function loadBot(botUserId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    });
}
