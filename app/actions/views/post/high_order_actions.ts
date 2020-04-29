// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionFunc, DispatchFunc, GetStateFunc, batchActions, SuccessResult} from '@mm-redux/types/actions';

import {getPostIdsInChannel} from '@mm-redux/selectors/entities/posts';

import {getPosts, getPostsSince} from '@actions/views/post';
import {
    setLoadMorePostsVisible,
    setChannelRetryFailed,
    setLastGetPostsForChannel,
} from '@actions/views/channels';
import {dispatchWithRetry} from '@actions/helpers/general';

import {ViewTypes} from '@constants';
import {getChannelSinceValue} from '@utils/channels';

export function loadPostsIfNecessaryWithRetry(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const postIds = getPostIdsInChannel(state, channelId);
        const actions = [];

        const time = Date.now();

        let postAction;
        if (!postIds || postIds.length < ViewTypes.POST_VISIBILITY_CHUNK_SIZE) {
            // Get the first page of posts if it appears we haven't gotten it yet, like the webapp
            postAction = getPosts(channelId);
        } else {
            const since = getChannelSinceValue(state, channelId, postIds);
            postAction = getPostsSince(channelId, since);
        }

        const result = await dispatch(dispatchWithRetry(postAction));
        const {data} = <SuccessResult>result;

        let loadMorePostsVisible = true;
        if (data) {
            actions.push(
                setLastGetPostsForChannel(channelId, time),
                setChannelRetryFailed(false),
            );

            if (data.order) {
                const count = data.order.length;
                loadMorePostsVisible = count >= ViewTypes.POST_VISIBILITY_CHUNK_SIZE;
            }
        } else {
            actions.push(setChannelRetryFailed(true));
        }

        actions.push(setLoadMorePostsVisible(loadMorePostsVisible));

        dispatch(batchActions(actions, 'BATCH_LOAD_POSTS_IN_CHANNEL'));

        return {data: true};
    };
}