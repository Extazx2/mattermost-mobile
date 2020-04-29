// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import {General, Preferences} from '@mm-redux/constants';

import {Client4} from '@mm-redux/client';

import * as CommonSelectors from '@mm-redux/selectors/entities/common'
import * as TeamSelectors from '@mm-redux/selectors/entities/teams';
import * as ChannelSelectors from '@mm-redux/selectors/entities/channels';

import * as RequestorActions from '@actions/channels/requestor_actions';
import * as ActionObjects from '@actions/channels/action_objects';
import * as ChannelActionHelpers from '@actions/helpers/channels';
import * as PreferenceActions from '@mm-redux/actions/preferences';
import * as RoleActions from '@mm-redux/actions/roles';

import * as PrefrenceUtils from '@utils/preferences';

import TestHelper from 'test/test_helper';

import * as Actions from './high_order_actions';

describe('Actions.Channels.HighOrderActions', () => {
    let store;
    const createMockStore = configureStore([thunk]);

    beforeEach(() => {
        store = createMockStore({});
    });

    describe('getChannelsByTeamName', () => {
        const currentTeam = TestHelper.fakeTeam();
        TeamSelectors.getCurrentTeamId = jest.fn().mockReturnValue(currentTeam.id);
        TeamSelectors.getTeamByName = jest.fn();
        RequestorActions.getMyChannelsAndMembersForTeam = jest.fn();

        it('returns error if no team found', async () => {
            TeamSelectors.getTeamByName.mockReturnValueOnce(null);

            const teamName = `not-${currentTeam.name}`;
            const result = await store.dispatch(Actions.getChannelsByTeamName(teamName));
            expect(result.error).toBeDefined();
        });

        it('does not dispatch if team is current team', async () => {
            TeamSelectors.getTeamByName.mockReturnValueOnce(currentTeam);

            expectedResult = {data: true};
            const emptyActions = [];

            const result = await store.dispatch(Actions.getChannelsByTeamName(currentTeam.name));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('returns error when getMyChannelsAndMembersForTeam throws error', async () => {
            const otherTeam = TestHelper.fakeTeam();
            TeamSelectors.getTeamByName.mockReturnValueOnce(otherTeam);
            RequestorActions.getMyChannelsAndMembersForTeam.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelsByTeamName(otherTeam.name));
            expect(result.error).toBeDefined();
        });

        it ('dispatches getMyChannelsAndMembersForTeam', async () => {
            const otherTeam = TestHelper.fakeTeam();
            TeamSelectors.getTeamByName.mockReturnValueOnce(otherTeam);

            const mockAction = (teamId) => ({
                type: 'my-channels-and-members-for-team',
                teamId,
            });
            RequestorActions.getMyChannelsAndMembersForTeam.mockImplementationOnce(mockAction);

            expectedResult = {data: true};
            expectedActions = [
                mockAction(otherTeam.id),
            ];

            const result = await store.dispatch(Actions.getChannelsByTeamName(currentTeam.name));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('markChannelAsUnread', () => {
        const userId = 'user-id';
        const channel = TestHelper.fakeChannel();
        CommonSelectors.getCurrentUserId = jest.fn().mockReturnValue(userId);
        ChannelSelectors.getChannel = jest.fn().mockReturnValue(channel);
        ChannelSelectors.getMyChannelMember = jest.fn();

        it('dispatches incrementTotalMessageCount and incrementUnreadMessageCount with correct onlyMentions value', async () => {
            const mentions = [];
            const onlyMentionsValues = [true, false];

            onlyMentionsValues.forEach(async (onlyMentions) => {
                const channelMember = {
                    ...TestHelper.fakeChannelMember(),
                    notify_props: {
                        mark_unread: onlyMention ? General.MENTION : null,
                    },
                };
                ChannelSelectors.getMyChannelMember.mockReturnValueOnce(channelMember);

                const expectedResult = {data: true};
                const expectedActions = [
                    ActionObjects.incrementTotalMessageCount(channel.id, 1),
                    ActionObjects.incrementUnreadMessageCount(channel, 1, onlyMentions),
                ];

                const result = await store.dispatch(Actions.markChannelAsUnread(channel.id, mentions));
                expect(result).toEqual(expectedResult);

                const actions = store.getActions();
                expect(actions.length).toEqual(1);

                const batchedActions = actions[0].payload;
                expect(batchedActions).toStrictEqual(expectedActions);
            });
        });

        it('dispatches incrementUnreadMentionCount only when mentions includes current user id', async () => {
            const mentionsValues = [
                [],
                [`not-${userId}`],
                [userId],
            ];
            mentionsValues.forEach(async (mentions) => {
                const channelMember = {
                    ...TestHelper.fakeChannelMember(),
                    notify_props: {
                        mark_unread: General.MENTION,
                    },
                };
                ChannelSelectors.getMyChannelMember.mockReturnValueOnce(channelMember);

                const expectedResult = {data: true};
                const expectedActions = [
                    ActionObjects.incrementTotalMessageCount(channel.id, 1),
                    ActionObjects.incrementUnreadMessageCount(channel, 1, true),
                ];
                if (mentions.includes(userId)) {
                    expectedActions.push(ActionObjects.incrementUnreadMentionCount(channel, 1));
                }

                const result = await store.dispatch(Actions.markChannelAsUnread(channel.id, mentions));
                expect(result).toEqual(expectedResult);

                const actions = store.getActions();
                expect(actions.length).toEqual(1);

                const batchedActions = actions[0].payload;
                expect(batchedActions).toStrictEqual(expectedActions);
            });
        });
    });

    describe('markChannelViewedAndRead', () => {
        const mockActions = () => ([{
            type: 'action-1'
        }, {
            type: 'action-2',
        }]);
        ChannelActionHelpers.markChannelAsViewedAndReadActions = jest.fn(mockActions);

        it('dispatches markChannelAsViewedAndReadActions', async () => {
            const channelId = 'channel-id';
            const prevChannelId = 'prev-channel-id';
            const markOnServer = false;
            const expectedResult = {data: true};
            const state = store.getState();

            const result = await store.dispatch(Actions.markChannelViewedAndRead(channelId, prevChannelId, markOnServer));
            expect(result).toStrictEqual(expectedResult);
            expect(ChannelActionHelpers.markChannelAsViewedAndReadActions).toHaveBeenCalledWith(state, channelId, prevChannelId, markOnServer);
        
            const actions = store.getActions();
            expect(actions.length).toEqual(1);

            const batchedActions = actions[0].payload;
            expect(batchedActions).toStrictEqual(mockActions());
        });
    });

    describe('favoriteChannel', () => {
        const mockAction = (userId, preferences) => ({
            type: 'save-preferences-action',
            userId,
            preferences,
        });
        PreferenceActions.savePreferences = jest.fn(mockAction);
        Client4.trackEvent = jest.fn();

        it('dispatches savePreferences and tracks event', async () => {
            const userId = 'user-id';
            const channelId = 'channel-id';
            const favoriteChannelPreference = PrefrenceUtils.buildPreference(
                Preferences.CATEGORY_FAVORITE_CHANNEL,
                userId,
                channelId,
                'true',
            );
            CommonSelectors.getCurrentUserId = jest.fn().mockReturnValue(userId);

            const expectedActions = [
                mockAction(userId, [favoriteChannelPreference]),
            ];
            await store.dispatch(Actions.favoriteChannel(channelId));

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            expectedCategory = 'action';
            expectedEvent = 'action_channels_favorite';
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent);
        });
    });

    describe('unfavoriteChannel', () => {
        const mockAction = (userId, preferences) => ({
            type: 'delete-preferences-action',
            userId,
            preferences,
        });
        PreferenceActions.deletePreferences = jest.fn(mockAction);
        Client4.trackEvent = jest.fn();

        it('dispatches deletePrefrences and tracks event', async () => {
            const userId = 'user-id';
            const channelId = 'channel-id';
            const unfavoriteChannelPreference = PrefrenceUtils.buildPreference(
                Preferences.CATEGORY_FAVORITE_CHANNEL,
                userId,
                channelId,
                '',
            );
            CommonSelectors.getCurrentUserId = jest.fn().mockReturnValue(userId);

            const expectedActions = [
                mockAction(userId, [unfavoriteChannelPreference]),
            ];
            await store.dispatch(Actions.unfavoriteChannel(channelId));

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            expectedCategory = 'action';
            expectedEvent = 'action_channels_unfavorite';
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent);
        });
    });

    describe('markChannelAsViewed', () => {
        const channelId = 'channel-id';
        const prevChannelId = 'prev-channel-id';

        ChannelSelectors.getMyChannelMember = jest.fn();
        ChannelSelectors.isManuallyUnread = jest.fn();

        const mockAction = (roles) => ({
            type: 'load-roles',
            roles,
        });
        RoleActions.loadRolesIfNeeded = jest.fn(mockAction);

        it('does not dispatch if not member of channel nor previous channel', async () => {
            const emptyActions = [];
            ChannelSelectors.getMyChannelMember.mockReturnValue(null);

            await store.dispatch(Actions.markChannelAsViewed(channelId, prevChannelId));

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('dispatches when member of channel that is not manually unread', async () => {
            const channelMember = TestHelper.fakeChannelMember();

            ChannelSelectors.getMyChannelMember.
                mockReturnValueOnce(channelMember).
                mockReturnValueOnce(null);

            ChannelSelectors.isManuallyUnread.
                mockReturnValue(false);

            const expectedActions = [
                mockAction(channelMember.roles.split(' ')),
            ];
            const expectedBatchedActions = [
                ActionObjects.receivedMyChannelMember(channelMember),
            ];


            await store.dispatch(Actions.markChannelAsViewed(channelId, prevChannelId));

            const actions = store.getActions();
            expect(actions.length).toEqual(2);
            expect(actions[0]).toStrictEqual(expectedActions[0]);

            const batchedActions = actions[1].payload;
            expect(batchedActions).toStrictEqual(expectedBatchedActions);
        });

        it('dispatches when member of channel that is manually unread', async () => {
            const channelMember = TestHelper.fakeChannelMember();

            ChannelSelectors.getMyChannelMember.
                mockReturnValueOnce(channelMember).
                mockReturnValueOnce(null);

            ChannelSelectors.isManuallyUnread.
                mockReturnValue(true);

            const expectedActions = [
                mockAction(channelMember.roles.split(' ')),
            ];
            const expectedBatchedActions = [
                ActionObjects.receivedMyChannelMember(channelMember),
                ActionObjects.removeManuallyUnread(channelId),
            ];


            await store.dispatch(Actions.markChannelAsViewed(channelId, prevChannelId));

            const actions = store.getActions();
            expect(actions.length).toEqual(2);
            expect(actions[0]).toStrictEqual(expectedActions[0]);

            const batchedActions = actions[1].payload;
            expect(batchedActions).toStrictEqual(expectedBatchedActions);
        });

        it('dispatches when member of previous channel that is not manually unread', async () => {
            const prevChannelMember = TestHelper.fakeChannelMember();

            ChannelSelectors.getMyChannelMember.
                mockReturnValueOnce(null).
                mockReturnValueOnce(prevChannelMember);

            ChannelSelectors.isManuallyUnread.
                mockReturnValue(false);

            const expectedActions = [
                mockAction(prevChannelMember.roles.split(' ')),
            ];
            const expectedBatchedActions = [
                ActionObjects.receivedMyChannelMember(prevChannelMember),
            ];


            await store.dispatch(Actions.markChannelAsViewed(channelId, prevChannelId));

            const actions = store.getActions();
            expect(actions.length).toEqual(2);
            expect(actions[0]).toStrictEqual(expectedActions[0]);

            const batchedActions = actions[1].payload;
            expect(batchedActions).toStrictEqual(expectedBatchedActions);
        });

        it('does not dispatch for previous channel that is manually unread', async () => {
            const prevChannelMember = TestHelper.fakeChannelMember();

            ChannelSelectors.getMyChannelMember.
                mockReturnValueOnce(null).
                mockReturnValueOnce(prevChannelMember);

            ChannelSelectors.isManuallyUnread.
                mockReturnValue(true);

            const emptyActions = [];

            await store.dispatch(Actions.markChannelAsViewed(channelId, prevChannelId));

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });
    });

    describe('addMultipleChannelMembers', () => {
        const channelId = 'channel-id';

        RequestorActions.addChannelMember = jest.fn();

        it('does not dispatch when userIds is empty', async () => {
            const emptyActions = [];
            const emptyResults = [];

            const userIds = [];
            const results = await store.dispatch(Actions.addMultipleChannelMembers(channelId, userIds));
            expect(results).toStrictEqual(emptyResults);

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('dispatches until error thrown in addChannelMember', async () => {
            const mockAction1 = {type: 'action-1'};
            const mockAction2 = {type: 'action-2'};
            const mockError = new Error();
            const mockAction3 = {type: 'action-3'};

            RequestorActions.addChannelMember.
                mockImplementationOnce(() => mockAction1).
                mockImplementationOnce(() => mockAction2).
                mockImplementationOnce(() => {throw mockError}).
                mockImplementationOnce(() => mockAction3);

            const userIds = ['user-1', 'user-2', 'user-3', 'user-4'];
            const results = await store.dispatch(Actions.addMultipleChannelMembers(channelId, userIds));
            expect(results).toEqual(mockError);

            const actions = store.getActions();
            expect(actions).toStrictEqual([mockAction1, mockAction2]);
        });
    });

    describe('removeMultipleChannelMembers', () => {
        const channelId = 'channel-id';

        RequestorActions.removeChannelMember = jest.fn();

        it('does not dispatch when userIds is empty', async () => {
            const emptyActions = [];
            const emptyResults = [];

            const userIds = [];
            const results = await store.dispatch(Actions.removeMultipleChannelMembers(channelId, userIds));
            expect(results).toStrictEqual(emptyResults);

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('dispatches until error thrown in removeChannelMember', async () => {
            const mockAction1 = {type: 'action-1'};
            const mockAction2 = {type: 'action-2'};
            const mockError = new Error();
            const mockAction3 = {type: 'action-3'};

            RequestorActions.removeChannelMember.
                mockImplementationOnce(() => mockAction1).
                mockImplementationOnce(() => mockAction2).
                mockImplementationOnce(() => {throw mockError}).
                mockImplementationOnce(() => mockAction3);

            const userIds = ['user-1', 'user-2', 'user-3', 'user-4'];
            const results = await store.dispatch(Actions.removeMultipleChannelMembers(channelId, userIds));
            expect(results).toEqual(mockError);

            const actions = store.getActions();
            expect(actions).toStrictEqual([mockAction1, mockAction2]);
        });
    });

    describe('loadDirectMessages', () => {
        const channels = [
            TestHelper.fakeChannel(),
            TestHelper.fakeChannel(),
        ];
        const channelMembers = [
            TestHelper.fakeChannelMember(),
            TestHelper.fakeChannelMember(),
        ];
        const expectedResult = {data: true};

        ChannelActionHelpers.loadDirectMessagesActions = jest.fn();

        it('does not dispatch when loadDirectMessagesActions is empty', async () => {
            const state = store.getState();

            const emptyActions = [];
            ChannelActionHelpers.loadDirectMessagesActions.mockReturnValueOnce(emptyActions);

            const result = await store.dispatch(Actions.loadDirectMessages(channels, channelMembers));
            expect(ChannelActionHelpers.loadDirectMessagesActions).toHaveBeenCalledWith(state, channels, channelMembers);
            expect(result).toStrictEqual(expectedResult)

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('batch dispatches loadDirectMessagesActions', async () => {
            const state = store.getState();

            const mockActions = [{type: 'action-1'}, {type: 'action-2'}];
            ChannelActionHelpers.loadDirectMessagesActions.mockReturnValueOnce(mockActions);

            const result = await store.dispatch(Actions.loadDirectMessages(channels, channelMembers));
            expect(ChannelActionHelpers.loadDirectMessagesActions).toHaveBeenCalledWith(state, channels, channelMembers);
            expect(result).toStrictEqual(expectedResult)

            const actions = store.getActions();
            expect(actions.length).toEqual(1);

            const batchedActions = actions[0].payload;
            expect(batchedActions).toStrictEqual(mockActions);
        });
    });
});