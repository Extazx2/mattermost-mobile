// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import initialState from 'app/initial_state';
import {ChannelTypes} from '@mm-redux/action_types';
import testHelper from 'test/test_helper';

import {ViewTypes} from 'app/constants';
import * as ChannelActions from '@actions/channels';
const {
    handleSelectChannel,
    // loadPostsIfNecessaryWithRetry, // moved to @actions/views/post/high_order_actions.ts
} = ChannelActions;
import {loadPostsIfNecessaryWithRetry} from '@actions/views/post';

import postReducer from '@mm-redux/reducers/entities/posts';

const MOCK_CHANNEL_MARK_AS_READ = 'MOCK_CHANNEL_MARK_AS_READ';
const MOCK_CHANNEL_MARK_AS_VIEWED = 'MOCK_CHANNEL_MARK_AS_VIEWED';

jest.mock('@actions/helpers/channels', () => {
    const actions = require.requireActual('@actions/helpers/channels');
    return {
        ...actions,
        markChannelAsViewedAndReadActions: jest.fn().mockReturnValue([
            {type: 'MOCK_CHANNEL_MARK_AS_READ'},
            {type: 'MOCK_CHANNEL_MARK_AS_VIEWED'},
        ]),
    };
});

jest.mock('@mm-redux/selectors/entities/teams', () => {
    const teamSelectors = require.requireActual('@mm-redux/selectors/entities/teams');
    return {
        ...teamSelectors,
        getTeamByName: jest.fn(() => ({name: 'current-team-name'})),
    };
});

const mockStore = configureStore([thunk]);

describe('Actions.Views.Channel', () => {
    let store;

    const MOCK_SELECT_CHANNEL_TYPE = 'MOCK_SELECT_CHANNEL_TYPE';
    const MOCK_RECEIVE_CHANNEL_TYPE = 'MOCK_RECEIVE_CHANNEL_TYPE';
    const MOCK_RECEIVED_POSTS = 'RECEIVED_POSTS';
    const MOCK_RECEIVED_POSTS_IN_CHANNEL = 'RECEIVED_POSTS_IN_CHANNEL';
    const MOCK_RECEIVED_POSTS_SINCE = 'MOCK_RECEIVED_POSTS_SINCE';

    const actions = require('@actions/channels');
    actions.getChannelByNameAndTeamName = jest.fn((teamName) => {
        if (teamName) {
            return {
                type: MOCK_RECEIVE_CHANNEL_TYPE,
                data: 'received-channel-id',
            };
        }

        return {
            type: 'MOCK_ERROR',
            error: 'error',
        };
    });
    actions.selectChannel = jest.fn().mockReturnValue({
        type: MOCK_SELECT_CHANNEL_TYPE,
        data: 'selected-channel-id',
    });
    const postActions = require('@actions/views/post/post.js');
    postActions.getPostsSince = jest.fn(() => {
        return {
            type: MOCK_RECEIVED_POSTS_SINCE,
            data: {
                order: [],
                posts: {},
            },
        };
    });

    postActions.getPosts = jest.fn((channelId) => {
        const order = [];
        const posts = {};

        for (let i = 0; i < 60; i++) {
            const p = testHelper.fakePostWithChannelId(channelId);
            order.push(p.id);
            posts[p.id] = p;
        }

        return {
            type: MOCK_RECEIVED_POSTS,
            data: {
                order,
                posts,
            },
        };
    });

    const postUtils = require('@mm-redux/utils/post_utils');
    postUtils.getLastCreateAt = jest.fn((array) => {
        return array[0].create_at;
    });

    let nextPostState = {};
    const currentUserId = 'current-user-id';
    const currentChannelId = 'channel-id';
    const currentChannelName = 'channel-name';
    const currentTeamId = 'current-team-id';
    const currentTeamName = 'current-team-name';
    const storeObj = {
        ...initialState,
        entities: {
            ...initialState.entities,
            users: {
                currentUserId,
            },
            channels: {
                currentChannelId,
                manuallyUnread: {},
                channels: {
                    'channel-id': {id: 'channel-id', display_name: 'Test Channel'},
                    'channel-id-2': {id: 'channel-id-2', display_name: 'Test Channel'},
                },
                myMembers: {
                    'channel-id': {channel_id: 'channel-id', user_id: currentUserId, mention_count: 0, msg_count: 0},
                    'channel-id-2': {channel_id: 'channel-id-2', user_id: currentUserId, mention_count: 0, msg_count: 0},
                },
            },
            teams: {
                currentTeamId,
                teams: {
                    [currentTeamId]: {
                        id: currentTeamId,
                        name: currentTeamName,
                    },
                },
            },
        },
    };

    const appChannelSelectors = require('app/selectors/channel');
    appChannelSelectors.getChannelReachable = jest.fn(() => true);

    const handleSelectChannelByName = jest.fn();

    test.skip('handleSelectChannelByName success', async () => {
        // handleSelectChannelByName was replaced by selectChannelFromDeepLinkMatch
        store = mockStore(storeObj);

        await store.dispatch(handleSelectChannelByName(currentChannelName, currentTeamName));

        const storeActions = store.getActions();
        const receivedChannel = storeActions.some((action) => action.type === MOCK_RECEIVE_CHANNEL_TYPE);
        expect(receivedChannel).toBe(true);

        const selectedChannel = storeActions.some(({type}) => type === MOCK_RECEIVE_CHANNEL_TYPE);
        expect(selectedChannel).toBe(true);
    });

    test.skip('handleSelectChannelByName failure from null currentTeamName', async () => {
        // handleSelectChannelByName was replaced by selectChannelFromDeepLinkMatch
        const failStoreObj = {...storeObj};
        failStoreObj.entities.teams.currentTeamId = 'not-in-current-teams';
        store = mockStore(failStoreObj);

        await store.dispatch(handleSelectChannelByName(currentChannelName, null));

        const storeActions = store.getActions();
        const receivedChannel = storeActions.some((action) => action.type === MOCK_RECEIVE_CHANNEL_TYPE);
        expect(receivedChannel).toBe(false);

        const storeBatchActions = storeActions.some(({type}) => type === 'BATCHING_REDUCER.BATCH');
        expect(storeBatchActions).toBe(false);
    });

    test.skip('handleSelectChannelByName failure from no permission to channel', async () => {
        // handleSelectChannelByName was replaced by selectChannelFromDeepLinkMatch
        store = mockStore({...storeObj});
        actions.getChannelByNameAndTeamName = jest.fn(() => {
            return {
                type: 'MOCK_ERROR',
                error: {
                    message: "Can't get to channel.",
                },
            };
        });

        await store.dispatch(handleSelectChannelByName(currentChannelName, currentTeamName));

        const storeActions = store.getActions();
        const receivedChannel = storeActions.some((action) => action.type === MOCK_RECEIVE_CHANNEL_TYPE);
        expect(receivedChannel).toBe(false);
    });

    test.skip('handleSelectChannelByName failure from unreachable channel', async () => {
        // handleSelectChannelByName was replaced by selectChannelFromDeepLinkMatch
        appChannelSelectors.getChannelReachable = jest.fn(() => false);

        store = mockStore(storeObj);

        await store.dispatch(handleSelectChannelByName(currentChannelName, currentTeamName));

        const storeActions = store.getActions();
        const receivedChannel = storeActions.some((action) => action.type === MOCK_RECEIVE_CHANNEL_TYPE);
        expect(receivedChannel).toBe(false);
    });

    test('loadPostsIfNecessaryWithRetry for the first time', async () => {
        store = mockStore(storeObj);

        await store.dispatch(loadPostsIfNecessaryWithRetry(currentChannelId));
        expect(postActions.getPosts).toBeCalled();

        const storeActions = store.getActions();
        const storeBatchActions = storeActions.filter(({type}) => type === 'BATCH_LOAD_POSTS_IN_CHANNEL');
        const receivedPosts = storeActions.find(({type}) => type === MOCK_RECEIVED_POSTS);
        const receivedPostsAtAction = storeBatchActions[0].payload.some((action) => action.type === ViewTypes.SET_LAST_GET_POSTS);

        nextPostState = postReducer(store.getState().entities.posts, receivedPosts);
        nextPostState = postReducer(nextPostState, {
            type: MOCK_RECEIVED_POSTS_IN_CHANNEL,
            channelId: currentChannelId,
            data: receivedPosts.data,
            recent: true,
        });

        expect(receivedPostsAtAction).toBe(true);
    });

    // test('loadPostsIfNecessaryWithRetry get posts since', async () => {
    //     store = mockStore({
    //         ...storeObj,
    //         entities: {
    //             ...storeObj.entities,
    //             posts: nextPostState,
    //         },
    //         views: {
    //             ...storeObj.views,
    //             channel: {
    //                 ...storeObj.views.channel,
    //                 lastGetPosts: {
    //                     [currentChannelId]: Date.now(),
    //                 },
    //             },
    //         },
    //     });

    //     await store.dispatch(loadPostsIfNecessaryWithRetry(currentChannelId));
    //     const storeActions = store.getActions();
    //     const receivedPostsSince = storeActions.find(({type}) => type === MOCK_RECEIVED_POSTS_SINCE);

    //     expect(postUtils.getLastCreateAt).toBeCalled();
    //     expect(postActions.getPostsSince).toHaveBeenCalledWith(currentChannelId, Object.values(store.getState().entities.posts.posts)[0].create_at);
    //     expect(receivedPostsSince).not.toBe(null);
    // });

    // test('loadPostsIfNecessaryWithRetry get posts since the websocket reconnected', async () => {
    //     const time = Date.now();
    //     store = mockStore({
    //         ...storeObj,
    //         entities: {
    //             ...storeObj.entities,
    //             posts: nextPostState,
    //         },
    //         views: {
    //             ...storeObj.views,
    //             channel: {
    //                 ...storeObj.views.channel,
    //                 lastGetPosts: {
    //                     [currentChannelId]: time,
    //                 },
    //             },
    //         },
    //         websocket: {
    //             lastConnectAt: time + (1 * 60 * 1000),
    //         },
    //     });

    //     await store.dispatch(loadPostsIfNecessaryWithRetry(currentChannelId));
    //     const storeActions = store.getActions();
    //     const receivedPostsSince = storeActions.find(({type}) => type === MOCK_RECEIVED_POSTS_SINCE);

    //     expect(postUtils.getLastCreateAt).not.toBeCalled();
    //     expect(postActions.getPostsSince).toHaveBeenCalledWith(currentChannelId, store.getState().views.channel.lastGetPosts[currentChannelId]);
    //     expect(receivedPostsSince).not.toBe(null);
    // });

    const handleSelectChannelCases = [
        [currentChannelId],
        [`${currentChannelId}-2`],
        [`not-${currentChannelId}`],
        [`not-${currentChannelId}-2`],
    ];
    test.each(handleSelectChannelCases)('handleSelectChannel dispatches selectChannelWithMember', async (channelId) => {
        const testObj = {...storeObj};
        store = mockStore(testObj);

        await store.dispatch(handleSelectChannel(channelId));
        const storeActions = store.getActions();
        const storeBatchActions = storeActions.find(({type}) => type === 'BATCH_SWITCH_CHANNEL');
        const selectChannelWithMember = storeBatchActions?.payload.find(({type}) => type === ChannelTypes.SELECT_CHANNEL);
        const viewedAction = storeActions.find(({type}) => type === MOCK_CHANNEL_MARK_AS_VIEWED);
        const readAction = storeActions.find(({type}) => type === MOCK_CHANNEL_MARK_AS_READ);

        const expectedSelectChannelWithMember = {
            type: ChannelTypes.SELECT_CHANNEL,
            data: channelId,
            extra: {
                channel: {
                    id: channelId,
                    display_name: 'Test Channel',
                },
                member: {
                    channel_id: channelId,
                    user_id: currentUserId,
                    mention_count: 0,
                    msg_count: 0,
                },
                teamId: currentTeamId,
            },
        };
        if (channelId.includes('not') || channelId === currentChannelId) {
            expect(selectChannelWithMember).toBe(undefined);
        } else {
            expect(selectChannelWithMember).toStrictEqual(expectedSelectChannelWithMember)
        }
        expect(viewedAction).not.toBe(null);
        expect(readAction).not.toBe(null);
    });
});