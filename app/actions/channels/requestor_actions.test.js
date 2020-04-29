// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import {Client4} from '@mm-redux/client';

import {General, Preferences} from '@mm-redux/constants';

import * as ChannelSelectors from '@mm-redux/selectors/entities/channels';
import * as CommonSelectors from '@mm-redux/selectors/entities/common';

import * as ChannelActionHelpers from '@actions/helpers/channels';
import * as ActionObjects from '@actions/channels/action_objects';
import * as ErrorActions from '@mm-redux/actions/errors';
import * as RoleActions from '@mm-redux/actions/roles';
import * as PreferenceActions from '@mm-redux/actions/preferences';
import * as UserActions from '@mm-redux/actions/users';

import * as PreferenceUtils from '@utils/preferences';
import * as ChannelUtils from '@mm-redux/utils/channel_utils';

import TestHelper from 'test/test_helper';

import * as Actions from './requestor_actions';

describe('Actions.Channels.RequestorActions', () => {
    let store;
    const createMockStore = configureStore([thunk]);

    beforeEach(() => {
        store = createMockStore({});
    });

    describe('createChannel', () => {
        const channel = TestHelper.fakeChannel();
        const channelMember = TestHelper.fakeChannelMember();
        const user = TestHelper.fakeUser();

        Client4.createChannel = jest.fn();
        ChannelSelectors.getChannel = jest.fn();
        ChannelSelectors.getMyChannelMember = jest.fn();
        ChannelActionHelpers.createMemberForNewChannel = jest.fn();
        RoleActions.loadRolesIfNeeded = jest.fn();

        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch createChannelFailure when Client4.createChannel throws error', async () => {
            Client4.createChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.createChannel(channel, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.createChannel).toHaveBeenCalledWith(channel);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.createChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should not dispatch receivedChannel, receivedMyChannelMember, nor loadRolesIfNeeded when channel and member are in state', async () => {
            Client4.createChannel.mockReturnValue(channel);
            ChannelSelectors.getChannel.mockReturnValue(channel);
            ChannelSelectors.getMyChannelMember.mockReturnValue(channelMember);

            expectedResult = {data: channel};
            const result = await store.dispatch(Actions.createChannel(channel, user.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.createChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch receivedChannel, receivedMyChannelMember, and loadRolesIfNeeded when channel and member are not in state', async () => {
            Client4.createChannel.mockReturnValue(channel);
            ChannelSelectors.getChannel.mockReturnValue(null);
            ChannelSelectors.getMyChannelMember.mockReturnValue(null);
            ChannelActionHelpers.createMemberForNewChannel.mockReturnValue(channelMember);
            RoleActions.loadRolesIfNeeded.mockImplementationOnce((roles) => ({
                type: 'load-roles',
                roles,
            }));

            expectedResult = {data: channel};
            const result = await store.dispatch(Actions.createChannel(channel, user.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedRoles = [General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE];
            const expectedActions = [
                RoleActions.loadRolesIfNeeded(expectedRoles),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.receivedMyChannelMember(channelMember),
                    ActionObjects.createChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('createDirectChannel', () => {
        const user = TestHelper.fakeUser();
        const otherUser = TestHelper.fakeUser();

        Client4.createDirectChannel = jest.fn();

        const mockPreference = {category: 'mock'};
        PreferenceUtils.buildPreference = jest.fn().mockReturnValue(mockPreference);

        PreferenceActions.savePreferences = jest.fn((userId, preferences) => ({
            type: 'save-preferences',
            userId,
            preferences,
        }));
        PreferenceActions.receivedPreferences = jest.fn((preferences) => ({
            type: 'received-preferences',
            preferences,
        }));
        UserActions.receivedProfilesListInChannel = jest.fn((channelId, profiles) => ({
            type: 'received-profiles-in-channel',
            channelId,
            profiles,
        }));
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch createChannelFailure when Client4.createDirectChannel throws error', async () => {
            Client4.createDirectChannel.mockImplementation(() => {throw new Error()});

            const result = await store.dispatch(Actions.createDirectChannel(user.id, otherUser.id));
            expect(result.error).toBeDefined();
            expect(Client4.createDirectChannel).toHaveBeenCalledWith([user.id, otherUser.id]);

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.createChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.createDirectChannel succeeds', async () => {
            const expectedChannel = TestHelper.fakeChannel();
            Client4.createDirectChannel.mockReturnValue(expectedChannel);
            
            const expectedRoles = [General.CHANNEL_USER_ROLE];
            const expectedMember = ChannelActionHelpers.createMemberForNewChannel(expectedChannel, user.id, expectedRoles);
            const expectedPreferences = [mockPreference, mockPreference];
            const expectedProfiles = [{id: user.id}, {id: otherUser.id}];
            const expectedResult = {data: expectedChannel};
            const expectedActions = [
                ActionObjects.createChannelRequest(),
                PreferenceActions.savePreferences(user.id, expectedPreferences),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(expectedChannel),
                    ActionObjects.receivedMyChannelMember(expectedMember),
                    PreferenceActions.receivedPreferences(expectedPreferences),
                    ActionObjects.createChannelSuccess(),
                    UserActions.receivedProfilesListInChannel(expectedChannel.id, expectedProfiles),
                ]),
                RoleActions.loadRolesIfNeeded(expectedRoles),
            ];

            const result = await store.dispatch(Actions.createDirectChannel(user.id, otherUser.id));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            expect(PreferenceUtils.buildPreference).toHaveBeenCalledTimes(2);

            const firstCallArgs = PreferenceUtils.buildPreference.mock.calls[0];
            expect(firstCallArgs[0]).toEqual(Preferences.CATEGORY_CHANNEL_OPEN_TIME);
            expect(firstCallArgs[1]).toEqual(user.id);
            expect(firstCallArgs[2]).toEqual(expectedChannel.id);
            // The last arg is a timestamp string computed in createDirectChannel

            const secondCallArgs = PreferenceUtils.buildPreference.mock.calls[1];
            expect(secondCallArgs).toEqual([
                Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                user.id,
                otherUser.id,
                'true',
            ]);
        });
    });

    describe('createGroupChannel', () => {
        const channel = TestHelper.fakeChannel();
        const currentUser = TestHelper.fakeUser();
        const otherUser = TestHelper.fakeUser();
        const userIds = [currentUser.id, otherUser.id];

        Client4.createGroupChannel = jest.fn();
        Client4.getMyChannelMember = jest.fn();
        ChannelSelectors.getMyChannelMember = jest.fn();
        CommonSelectors.getCurrentUserId = jest.fn().mockReturnValue(currentUser.id);

        PreferenceActions.markGroupChannelOpen = jest.fn((channelId) => ({
            type: 'mark-group-channel-open',
            channelId,
        }));
        RoleActions.loadRolesIfNeeded = jest.fn((roles) => ({
            type: 'load-roles',
            roles,
        }));
        UserActions.receivedProfilesListInChannel = jest.fn((channelId, profiles) => ({
            type: 'received-profiles-in-channel',
            channelId,
            profiles,
        }));
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch createChannelFailure when Client4.createGroupChannel throws error', async () => {
            Client4.createGroupChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.createGroupChannel(userIds));
            expect(result.error).toBeDefined();
            expect(Client4.createGroupChannel).toHaveBeenCalledWith(userIds);

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.createChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch with created member when created group channel has no posts', async () => {
            const expectedChannel = {
                ...channel,
                total_msg_count: 0,
            };
            Client4.createGroupChannel.mockReturnValue(expectedChannel);
            
            const roles = [General.CHANNEL_USER_ROLE];
            const expectedMember = ChannelActionHelpers.createMemberForNewChannel(expectedChannel, currentUser.id, roles);
            const expectedProfiles = [
                ...userIds.map((id) => ({id})),
                {id: currentUser.id},
            ];

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                PreferenceActions.markGroupChannelOpen(expectedChannel.id),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(expectedChannel),
                    ActionObjects.receivedMyChannelMember(expectedMember),
                    ActionObjects.createChannelSuccess(),
                    UserActions.receivedProfilesListInChannel(expectedChannel.id, expectedProfiles),
                ]),
                RoleActions.loadRolesIfNeeded(expectedMember.roles.split(' ')),
            ];
            const expectedResult = {data: expectedChannel};

            const result = await store.dispatch(Actions.createGroupChannel(userIds));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch with existing member when created group channel already has posts and member exists', async () => {
            const expectedChannel = {
                ...channel,
                total_msg_count: 1,
            };
            Client4.createGroupChannel.mockReturnValueOnce(expectedChannel);
            
            const expectedMember = {
                ...TestHelper.fakeChannelMember(),
                roles: 'fake-role-1, fake-role-2',
            };
            ChannelSelectors.getMyChannelMember.mockReturnValueOnce(expectedMember);

            const expectedProfiles = [
                ...userIds.map((id) => ({id})),
                {id: currentUser.id},
            ];

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                PreferenceActions.markGroupChannelOpen(expectedChannel.id),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(expectedChannel),
                    ActionObjects.receivedMyChannelMember(expectedMember),
                    ActionObjects.createChannelSuccess(),
                    UserActions.receivedProfilesListInChannel(expectedChannel.id, expectedProfiles),
                ]),
                RoleActions.loadRolesIfNeeded(expectedMember.roles.split(' ')),
            ];
            const expectedResult = {data: expectedChannel};

            const result = await store.dispatch(Actions.createGroupChannel(userIds));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch with created member when created group channel already has posts and member does not exist but fetch member fails', async () => {
            const expectedChannel = {
                ...channel,
                total_msg_count: 1,
            };
            Client4.createGroupChannel.mockReturnValueOnce(expectedChannel);
            
            const roles = [General.CHANNEL_USER_ROLE];
            const expectedMember = ChannelActionHelpers.createMemberForNewChannel(expectedChannel, currentUser.id, roles);
            ChannelSelectors.getMyChannelMember.mockReturnValueOnce(null);

            const expectedError = new Error();
            Client4.getMyChannelMember.mockImplementationOnce(() => {throw expectedError});

            const expectedProfiles = [
                ...userIds.map((id) => ({id})),
                {id: currentUser.id},
            ];

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                ErrorActions.logError(expectedError),
                PreferenceActions.markGroupChannelOpen(expectedChannel.id),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(expectedChannel),
                    ActionObjects.receivedMyChannelMember(expectedMember),
                    ActionObjects.createChannelSuccess(),
                    UserActions.receivedProfilesListInChannel(expectedChannel.id, expectedProfiles),
                ]),
                RoleActions.loadRolesIfNeeded(expectedMember.roles.split(' ')),
            ];
            const expectedResult = {data: expectedChannel};

            const result = await store.dispatch(Actions.createGroupChannel(userIds));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch with fetched member when created group channel already has posts and member does not exists', async () => {
            const expectedChannel = {
                ...channel,
                total_msg_count: 1,
            };
            Client4.createGroupChannel.mockReturnValueOnce(expectedChannel);
            
            const expectedMember = {
                ...TestHelper.fakeChannelMember(),
                roles: 'fake-role-1, fake-role-2',
            };
            ChannelSelectors.getMyChannelMember.mockReturnValueOnce(null);
            Client4.getMyChannelMember.mockReturnValueOnce(expectedMember);

            const expectedProfiles = [
                ...userIds.map((id) => ({id})),
                {id: currentUser.id},
            ];

            const expectedActions = [
                ActionObjects.createChannelRequest(),
                PreferenceActions.markGroupChannelOpen(expectedChannel.id),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(expectedChannel),
                    ActionObjects.receivedMyChannelMember(expectedMember),
                    ActionObjects.createChannelSuccess(),
                    UserActions.receivedProfilesListInChannel(expectedChannel.id, expectedProfiles),
                ]),
                RoleActions.loadRolesIfNeeded(expectedMember.roles.split(' ')),
            ];
            const expectedResult = {data: expectedChannel};

            const result = await store.dispatch(Actions.createGroupChannel(userIds));
            expect(result).toStrictEqual(expectedResult);

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannels', () => {
        const team = TestHelper.fakeTeam();

        Client4.getChannels = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getChannelsFailure when Client4.getChannels throws error', async () => {
            Client4.getChannels.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannels(team.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannels).toHaveBeenCalledWith(team.id, page=0, number=General.CHANNELS_CHUNK_SIZE);

            const expectedActions = [
                ActionObjects.getChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.getChannelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.getChannels.mockReturnValueOnce(channels);

            const expectedResult = {data: channels};
            const result = await store.dispatch(Actions.getChannels(team.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.getChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannels(team.id, channels),
                    ActionObjects.getChannelsSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getAllChannels', () => {
        Client4.getAllChannels = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getAllChannelsFailure when Client4.getAllChannels throws error', async () => {
            Client4.getAllChannels.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getAllChannels());
            expect(result.error).toBeDefined();
            expect(Client4.getAllChannels).toHaveBeenCalledWith(page=0, number=General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup='', excludeDefaultChannels=false);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.getAllChannelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getAllChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.getAllChannels.mockReturnValueOnce(channels);

            const expectedResult = {data: channels};
            const result = await store.dispatch(Actions.getAllChannels());
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedAllChannels(channels),
                    ActionObjects.getAllChannelsSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getAllChannelsWithCount', () => {
        Client4.getAllChannels = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getAllChannelsFailure when Client4.getAllChannels throws error', async () => {
            Client4.getAllChannels.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getAllChannelsWithCount());
            expect(result.error).toBeDefined();
            expect(Client4.getAllChannels).toHaveBeenCalledWith(page=0, number=General.CHANNELS_CHUNK_SIZE, notAssociatedToGroup='', excludeDefaultChannels=false, includeTotalCount=true);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.getAllChannelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getAllChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.getAllChannels.mockReturnValueOnce({channels, total_count: channels.length});

            const expectedResult = {data: {channels, total_count: channels.length}};
            const result = await store.dispatch(Actions.getAllChannelsWithCount());
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedAllChannels(channels),
                    ActionObjects.getAllChannelsSuccess(),
                    ActionObjects.receivedTotalChannelCount(channels.length),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getArchivedChannels', () => {
        const team = TestHelper.fakeTeam();

        Client4.getArchivedChannels = jest.fn();

        it('should not dispatch when Client4.getArchivedChannels throws error', async () => {
            Client4.getArchivedChannels.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getArchivedChannels(team.id));
            expect(result.error).toBeDefined();
            expect(Client4.getArchivedChannels).toHaveBeenCalledWith(team.id, page=0, perPage=General.CHANNELS_CHUNK_SIZE);

            const emptyActions = [];

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('should dispatch when Client4.getArchivedChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.getArchivedChannels.mockReturnValueOnce(channels);

            const expectedResult = {data: channels};
            const result = await store.dispatch(Actions.getArchivedChannels(team.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.receivedChannels(team.id, channels),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelsForSearch', () => {
        const team = TestHelper.fakeTeam();
        const term = 'term';

        Client4.searchArchivedChannels = jest.fn();
        Client4.searchChannels = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getChannelsFailure when Client4.searchArchivedChannels or Client4.searchChannels throws error', async () => {
            Client4.searchArchivedChannels.mockImplementationOnce(() => {throw new Error()});
            Client4.searchChannels.mockImplementationOnce(() => {throw new Error()});

            const searchArchivedValues = [true, false];
            searchArchivedValues.forEach((searchArchived) => async () => {
                const result = await store.dispatch(Actions.getChannelsForSearch(team.id, term, searchArchived));
                expect(result.error).toBeDefined();
                if (searchArchived) {
                    expect(Client4.searchArchivedChannels).toHaveBeenCalledWith(team.id, term);
                } else {
                    expect(Client4.searchChannels).toHaveBeenCalledWith(team.id, term);
                }

                const expectedActions = [
                    ActionObjects.getChannelsRequest(),
                    TestHelper.buildBatchAction([
                        ActionObjects.getChannelsFailure(result.error),
                        ErrorActions.logError(result.error),
                    ]),
                ];

                const actions = store.getActions();
                expect(actions).toStrictEqual(expectedActions);
            });
        });

        it('should dispatch when Client4.searchArchivedChannels or Client4.searchChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.searchArchivedChannels.mockReturnValueOnce(channels);
            Client4.searchChannels.mockReturnValueOnce(channels);

            const searchArchivedValues = [true, false];
            searchArchivedValues.forEach((searchArchived) => async () => {
                const expectedResult = {data: channels};
                const result = await store.dispatch(Actions.getChannelsForSearch(team.id, term));
                expect(result).toStrictEqual(expectedResult);
                if (searchArchived) {
                    expect(Client4.searchArchivedChannels).toHaveBeenCalledTimes(1);
                } else {
                    expect(Client4.searchChannels).toHaveBeenCalledTimes(1);
                }

                const expectedActions = [
                    ActionObjects.getChannelsRequest(),
                    TestHelper.buildBatchAction([
                        ActionObjects.receivedChannels(team.id, channels),
                        ActionObjects.getChannelsSuccess(),
                    ]),
                ];

                const actions = store.getActions();
                expect(actions).toStrictEqual(expectedActions);
            });
        });
    });

    describe('getAllChannelsForSearch', () => {
        const term = 'term';

        Client4.searchAllChannels = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getAllChannelsFailure when Client4.searchAllChannels throws error', async () => {
            Client4.searchAllChannels.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getAllChannelsForSearch(term));
            expect(result.error).toBeDefined();
            expect(Client4.searchAllChannels).toHaveBeenCalledWith(term, notAssociatedToGroup='', excludeDefaultChannels=false, page=undefined, perPage=undefined);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.getAllChannelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.searchAllChannels succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.searchAllChannels.mockReturnValueOnce(channels);

            const expectedResult = {data: channels};
            const result = await store.dispatch(Actions.getAllChannelsForSearch(term));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.getAllChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedAllChannels(channels),
                    ActionObjects.getAllChannelsSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelsForAutocompleteSearch', () => {
        const team = TestHelper.fakeTeam();
        const term = '';

        Client4.autocompleteChannelsForSearch = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch getChannelsFailure when Client4.autocompleteChannelsForSearch throws error', async () => {
            Client4.autocompleteChannelsForSearch.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelsForAutocompleteSearch(team.id, term));
            expect(result.error).toBeDefined();
            expect(Client4.autocompleteChannelsForSearch).toHaveBeenCalledWith(team.id, term);

            const expectedActions = [
                ActionObjects.getChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.getChannelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.autocompleteChannelsForSearch succeeds', async () => {
            const channels = [
                TestHelper.fakeChannel(),
                TestHelper.fakeChannel(),
            ];
            Client4.autocompleteChannelsForSearch.mockReturnValueOnce(channels);

            const expectedResult = {data: channels};
            const result = await store.dispatch(Actions.getChannelsForAutocompleteSearch(team.id, term));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.getChannelsRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannels(team.id, channels),
                    ActionObjects.getChannelsSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getMyChannelsAndMembersForTeam', () => {
        it('TODO', () => {

        });
    });

    describe('getChannel', () => {
        const channel = TestHelper.fakeChannel();

        Client4.getChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch channelsFailure when Client4.getChannel throws error', async () => {
            Client4.getChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannel(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannel).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.channelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getChannel succeeds', async () => {
            Client4.getChannel.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.getChannel(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.receivedChannel(channel),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelByNameAndTeamName', () => {
        const team = TestHelper.fakeTeam();
        const channel = TestHelper.fakeChannel();

        Client4.getChannelByNameAndTeamName = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch channelsFailure when Client4.getChannelByNameAndTeamName throws error', async () => {
            Client4.getChannelByNameAndTeamName.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelByNameAndTeamName(team.name, channel.name));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelByNameAndTeamName).toHaveBeenCalledWith(team.name, channel.name, includeDeleted=false);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.channelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getChannelByNameAndTeamName succeeds', async () => {
            Client4.getChannelByNameAndTeamName.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.getChannelByNameAndTeamName(team.name, channel.name));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.receivedChannel(channel),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelAndMyMember', () => {
        const channel = TestHelper.fakeChannel();
        const member = TestHelper.fakeChannelMember();

        Client4.getChannel = jest.fn();
        Client4.getMyChannelMember = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        RoleActions.loadRolesIfNeeded = jest.fn((roles) => ({
            type: 'load-roles',
            roles,
        }));

        it('should dispatch channelsFailure when Client4.getChannel throws error', async () => {
            Client4.getChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelAndMyMember(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannel).toHaveBeenCalledWith(channel.id);
            expect(Client4.getMyChannelMember).not.toHaveBeenCalled();

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.channelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch channelsFailure when Client4.getMyChannelMember throws error', async () => {
            Client4.getChannel.mockReturnValueOnce(channel);
            Client4.getMyChannelMember.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelAndMyMember(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannel).toHaveBeenCalledWith(channel.id);
            expect(Client4.getMyChannelMember).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.channelsFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when both Client4.getChannel and Client4.getMyChannelMember succeed', async () => {
            Client4.getChannel.mockReturnValueOnce(channel);
            Client4.getMyChannelMember.mockReturnValueOnce(member);

            const expectedResult = {data: {channel, member}};
            const result = await store.dispatch(Actions.getChannelAndMyMember(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.receivedMyChannelMember(member),
                ]),
                RoleActions.loadRolesIfNeeded(member.roles.split(' ')),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelTimezones', () => {
        const channel = TestHelper.fakeChannel();

        Client4.getChannelTimezones = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch logError when Client4.getChannelTimezones throws error', async () => {
            Client4.getChannelTimezones.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelTimezones(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelTimezones).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should not dispatch when Client4.getChannelTimezones succeeds', async () => {
            const timezones = ['timezone-1', 'timezone-2'];
            Client4.getChannelTimezones.mockReturnValueOnce(timezones);

            const expectedResult = {data: timezones};
            const result = await store.dispatch(Actions.getChannelTimezones(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const emptyActions = [];

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });
    });

    describe('getChannelStats', () => {
        const channel = TestHelper.fakeChannel();

        Client4.getChannelStats = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch logError when Client4.getChannelStats throws error', async () => {
            Client4.getChannelStats.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelStats(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelStats).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getChannelStats succeeds', async () => {
            const stats = {
                channel_id: channel.id,
                member_count: 10,
                pinnedpost_count: 0,
            };
            Client4.getChannelStats.mockReturnValueOnce(stats);

            const expectedResult = {data: stats};
            const result = await store.dispatch(Actions.getChannelStats(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.receivedChannelStats(stats),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getChannelMembers', () => {
        const channel = TestHelper.fakeChannel();

        Client4.getChannelMembers = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        UserActions.getMissingProfilesByIds = jest.fn((userIds) => ({
            type: 'get-missing-profiles',
            userIds,
        }));

        it('should dispatch logError when Client4.getChannelMembers throws error', async () => {
            Client4.getChannelMembers.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getChannelMembers(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelMembers).toHaveBeenCalledWith(channel.id, page=0, perPage=General.CHANNELS_CHUNK_SIZE);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.getChannelMembers succeeds', async () => {
            const channelMembers = [
                TestHelper.fakeChannelMember(),
                TestHelper.fakeChannelMember(),
            ];
            Client4.getChannelMembers.mockReturnValueOnce(channelMembers);

            const expectedResult = {data: channelMembers};
            const result = await store.dispatch(Actions.getChannelMembers(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedUserIds = channelMembers.map((member) => member.user_id);
            const expectedActions = [
                UserActions.getMissingProfilesByIds(expectedUserIds),
                ActionObjects.receivedChannelMembers(channelMembers),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getMyChannelMember', () => {
        const channel = TestHelper.fakeChannel();

        Client4.getMyChannelMember = jest.fn();

        it('should not dispatch when Client4.getMyChannelMember throws error', async () => {
            Client4.getMyChannelMember.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.getMyChannelMember(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.getMyChannelMember).toHaveBeenCalledWith(channel.id);

            const emptyActions = [];

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });

        it('should dispatch when Client4.getMyChannelMember succeeds', async () => {
            const channelMember = TestHelper.fakeChannelMember();
            Client4.getMyChannelMember.mockReturnValueOnce(channelMember);

            const expectedResult = {data: channelMember};
            const result = await store.dispatch(Actions.getMyChannelMember(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.receivedMyChannelMember(channelMember),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('getMyChannelMembers', () => {
        it('TODO', () => {

        });
    });

    describe('patchChannel', () => {
        const channel = TestHelper.fakeChannel();

        Client4.patchChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch updateChannelFailure when Client4.patchChannel throws error', async () => {
            Client4.patchChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.patchChannel(channel.id, channel));
            expect(result.error).toBeDefined();
            expect(Client4.patchChannel).toHaveBeenCalledWith(channel.id, channel);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.updateChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.patchChannel succeeds', async () => {
            Client4.patchChannel.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.patchChannel(channel.id, channel));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.updateChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('updateChannel', () => {
        const channel = TestHelper.fakeChannel();

        Client4.updateChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch updateChannelFailure when Client4.updateChannel throws error', async () => {
            Client4.updateChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.updateChannel(channel));
            expect(result.error).toBeDefined();
            expect(Client4.updateChannel).toHaveBeenCalledWith(channel);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.updateChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.updateChannel succeeds', async () => {
            Client4.updateChannel.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.updateChannel(channel));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.updateChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('updateChannelPrivacy', () => {
        const channel = TestHelper.fakeChannel();
        const privacy = 'privacy';

        Client4.updateChannelPrivacy = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch updateChannelFailure when Client4.updateChannelPrivacy throws error', async () => {
            Client4.updateChannelPrivacy.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.updateChannelPrivacy(channel.id, privacy));
            expect(result.error).toBeDefined();
            expect(Client4.updateChannelPrivacy).toHaveBeenCalledWith(channel.id, privacy);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.updateChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.updateChannelPrivacy succeeds', async () => {
            Client4.updateChannelPrivacy.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.updateChannelPrivacy(channel.id, privacy));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.updateChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('updateChannelNotifyProps', () => {
        it('TODO', () => {

        });
    });

    describe('convertChannelToPrivate', () => {
        const channel = TestHelper.fakeChannel();

        Client4.convertChannelToPrivate = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch updateChannelFailure when Client4.convertChannelToPrivate throws error', async () => {
            Client4.convertChannelToPrivate.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.convertChannelToPrivate(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.convertChannelToPrivate).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.updateChannelFailure(result.error),
                    ErrorActions.logError(result.error),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch when Client4.convertChannelToPrivate succeeds', async () => {
            Client4.convertChannelToPrivate.mockReturnValueOnce(channel);

            const expectedResult = {data: channel};
            const result = await store.dispatch(Actions.convertChannelToPrivate(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                ActionObjects.updateChannelRequest(),
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.updateChannelSuccess(),
                ]),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });
    });

    describe('unarchiveChannel', () => {
        const channel = TestHelper.fakeChannel();

        Client4.unarchiveChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));

        it('should dispatch logError when Client4.unarchiveChannel throws error', async () => {
            Client4.unarchiveChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.unarchiveChannel(channel.id));
            expect(result.error).toBeDefined();
            expect(Client4.unarchiveChannel).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should not dispatch when Client4.unarchiveChannel succeeds', async () => {
            Client4.unarchiveChannel.mockReturnValueOnce(channel);

            const expectedResult = {data: true};
            const result = await store.dispatch(Actions.unarchiveChannel(channel.id));
            expect(result).toStrictEqual(expectedResult);

            const emptyActions = [];

            const actions = store.getActions();
            expect(actions).toStrictEqual(emptyActions);
        });
    });

    describe('markChannelAsRead', () => {
        it('TODO', () => {

        });
    });

    describe('addChannelMember', () => {
        const channel = TestHelper.fakeChannel();
        const user = TestHelper.fakeUser();

        Client4.addToChannel = jest.fn();
        Client4.trackEvent = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        UserActions.receivedProfileInChannel = jest.fn((channelId, userId) => ({
            type: 'received-profile-in-channel',
            channelId,
            userId,
        }));

        it('should dispatch logError when Client4.addToChannel throws error', async () => {
            Client4.addToChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.addChannelMember(channel.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.addToChannel).toHaveBeenCalledWith(user.id, channel.id, postRootId='');

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch and track event when Client4.addToChannel succeeds', async () => {
            const channelMember = TestHelper.fakeChannelMember();
            Client4.addToChannel.mockReturnValueOnce(channelMember);

            const expectedResult = {data: channelMember};
            const result = await store.dispatch(Actions.addChannelMember(channel.id, user.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    UserActions.receivedProfileInChannel(channel.id, user.id),
                    ActionObjects.receivedChannelMember(channelMember),
                    ActionObjects.addChannelMemberSuccess(channel.id),
                ], 'ADD_CHANNEL_MEMBER.BATCH'),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            const expectedCategory = 'action';
            const expectedEvent = 'action_channels_add_member';
            const expectedEventData = {channel_id: channel.id};
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent, expectedEventData);
        });
    });

    describe('removeChannelMember', () => {
        const channel = TestHelper.fakeChannel();
        const user = TestHelper.fakeUser();

        Client4.removeFromChannel = jest.fn();
        Client4.trackEvent = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        UserActions.receivedProfileNotInChannel = jest.fn((channelId, userId) => ({
            type: 'received-profile-not-in-channel',
            channelId,
            userId,
        }));

        it('should dispatch logError when Client4.removeFromChannel throws error', async () => {
            Client4.removeFromChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.removeChannelMember(channel.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.removeFromChannel).toHaveBeenCalledWith(user.id, channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch and track event when Client4.removeFromChannel succeeds', async () => {
            const channelMember = TestHelper.fakeChannelMember();
            Client4.removeFromChannel.mockReturnValueOnce(channelMember);

            const expectedResult = {data: true};
            const result = await store.dispatch(Actions.removeChannelMember(channel.id, user.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    UserActions.receivedProfileNotInChannel(channel.id, user.id),
                    ActionObjects.removeChannelMemberSuccess(channel.id),
                ], 'REMOVE_CHANNEL_MEMBER.BATCH'),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            const expectedCategory = 'action';
            const expectedEvent = 'action_channels_remove_member';
            const expectedEventData = {channel_id: channel.id};
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent, expectedEventData);
        });
    });

    describe('joinChannelById', () => {
        const channel = TestHelper.fakeChannel();
        const user = TestHelper.fakeUser();
        const member = TestHelper.fakeChannelMember();

        Client4.addToChannel = jest.fn();
        Client4.getChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        RoleActions.loadRolesIfNeeded = jest.fn((roles) => ({
            type: 'load-roles',
            roles,
        }));

        it('should dispatch logError when Client4.addToChannel throws error', async () => {
            Client4.addToChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.joinChannelById(channel.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.addToChannel).toHaveBeenCalledWith(user.id, channel.id);
            expect(Client4.getChannel).not.toHaveBeenCalled();

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch logError when Client4.getChannel throws error', async () => {
            Client4.addToChannel.mockReturnValueOnce(member);
            Client4.getChannel.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.joinChannelById(channel.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.addToChannel).toHaveBeenCalledWith(user.id, channel.id);
            expect(Client4.getChannel).toHaveBeenCalledWith(channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch and track event when both Client4.addToChannel and Client4.getChannel succeed', async () => {
            Client4.addToChannel.mockReturnValueOnce(member);
            Client4.getChannel.mockReturnValueOnce(channel);

            const expectedResult = {data: {channel, member}};
            const result = await store.dispatch(Actions.joinChannelById(channel.id, user.id));
            expect(result).toStrictEqual(expectedResult);

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.receivedMyChannelMember(member),
                ]),
                RoleActions.loadRolesIfNeeded(member.roles.split(' ')),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            const expectedCategory = 'action';
            const expectedEvent = 'action_channels_join';
            const expectedEventData = {channel_id: channel.id};
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent, expectedEventData);
        });
    });

    describe('joinChannelByName', () => {
        const team = TestHelper.fakeTeam();
        const channel = TestHelper.fakeChannel();
        const user = TestHelper.fakeUser();
        const member = TestHelper.fakeChannelMember();

        Client4.getChannelByName = jest.fn();
        Client4.getChannelMember = jest.fn();
        Client4.addToChannel = jest.fn();
        ChannelUtils.isGroupChannel = jest.fn();
        ChannelUtils.isDirectChannel = jest.fn();
        ErrorActions.logError = jest.fn((error) => ({
            type: 'mock-error',
            error,
        }));
        RoleActions.loadRolesIfNeeded = jest.fn((roles) => ({
            type: 'load-roles',
            roles,
        }));

        it('should dispatch logError when Client4.getChannelByName throws error', async () => {
            Client4.getChannelByName.mockImplementationOnce(() => {throw new Error()});

            const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelByName).toHaveBeenCalledWith(team.id, channel.name, includeDeleted=true);
            expect(Client4.getChannelMember).not.toHaveBeenCalled();
            expect(Client4.addToChannel).not.toHaveBeenCalled();

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch logError when Client4.getChannelMember throws error', async () => {
            Client4.getChannelByName.mockReturnValueOnce(channel);
            Client4.getChannelMember.mockImplementationOnce(() => {throw new Error()});
            ChannelUtils.isGroupChannel.mockReturnValueOnce(true);

            const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelByName).toHaveBeenCalledWith(team.id, channel.name, includeDeleted=true);
            expect(Client4.getChannelMember).toHaveBeenCalledWith(channel.id, user.id);
            expect(Client4.addToChannel).not.toHaveBeenCalled();

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch logError when Client4.getChannelMember throws error', async () => {
            Client4.getChannelByName.mockReturnValueOnce(channel);
            Client4.getChannelMember.mockImplementationOnce(() => {throw new Error()});
            ChannelUtils.isGroupChannel.mockReturnValueOnce(false);
            ChannelUtils.isDirectChannel.mockReturnValueOnce(true);

            const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelByName).toHaveBeenCalledWith(team.id, channel.name, includeDeleted=true);
            expect(Client4.getChannelMember).toHaveBeenCalledWith(channel.id, user.id);
            expect(Client4.addToChannel).not.toHaveBeenCalled();

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch logError when Client4.addToChannel throws error', async () => {
            Client4.getChannelByName.mockReturnValueOnce(channel);
            Client4.addToChannel.mockImplementationOnce(() => {throw new Error()});
            ChannelUtils.isGroupChannel.mockReturnValueOnce(false);
            ChannelUtils.isDirectChannel.mockReturnValueOnce(false);

            const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
            expect(result.error).toBeDefined();
            expect(Client4.getChannelByName).toHaveBeenCalledWith(team.id, channel.name, includeDeleted=true);
            expect(Client4.getChannelMember).not.toHaveBeenCalled();
            expect(Client4.addToChannel).toHaveBeenCalledWith(user.id, channel.id);

            const expectedActions = [
                ErrorActions.logError(result.error),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);
        });

        it('should dispatch and track event when Client4.getChannelMember succeeds for group or direct channel', async () => {
            const isGroupValues = [true, false];
            isGroupValues.forEach(async (isGroup) => {
                Client4.getChannelByName.mockReturnValueOnce(channel);
                Client4.getChannelMember.mockReturnValueOnce(member);
                if (isGroup) {
                    ChannelUtils.isGroupChannel.mockReturnValueOnce(true);
                } else {
                    ChannelUtils.isGroupChannel.mockReturnValueOnce(false);
                    ChannelUtils.isDirectChannel.mockReturnValueOnce(true);
                }

                const expectedResult = {data: {channel, member}};
                const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
                expect(result).toStrictEqual(expectedResult);
                expect(Client4.getChannelByName).toHaveBeenCalled();
                expect(Client4.getChannelMember).toHaveBeenCalled();
                expect(Client4.addToChannel).not.toHaveBeenCalled();

                const expectedActions = [
                    TestHelper.buildBatchAction([
                        ActionObjects.receivedChannel(channel),
                        ActionObjects.receivedMyChannelMember(member),
                    ]),
                    RoleActions.loadRolesIfNeeded(member.roles.split(' ')),
                ];

                const actions = store.getActions();
                expect(actions).toStrictEqual(expectedActions);

                const expectedCategory = 'action';
                const expectedEvent = 'action_channels_join';
                const expectedEventData = {channel_id: channel.id};
                expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent, expectedEventData);
            });
        });

        it('should dispatch and track event when Client4.addToChannel succeeds', async () => {
            Client4.getChannelByName.mockReturnValueOnce(channel);
            Client4.addToChannel.mockReturnValueOnce(member);
            ChannelUtils.isGroupChannel.mockReturnValueOnce(false);
            ChannelUtils.isDirectChannel.mockReturnValueOnce(false);

            const expectedResult = {data: {channel, member}};
            const result = await store.dispatch(Actions.joinChannelByName(channel.name, team.id, user.id));
            expect(result).toStrictEqual(expectedResult);
            expect(Client4.getChannelByName).toHaveBeenCalled();
            expect(Client4.addToChannel).toHaveBeenCalled();
            expect(Client4.getChannelMember).not.toHaveBeenCalled();

            const expectedActions = [
                TestHelper.buildBatchAction([
                    ActionObjects.receivedChannel(channel),
                    ActionObjects.receivedMyChannelMember(member),
                ]),
                RoleActions.loadRolesIfNeeded(member.roles.split(' ')),
            ];

            const actions = store.getActions();
            expect(actions).toStrictEqual(expectedActions);

            const expectedCategory = 'action';
            const expectedEvent = 'action_channels_join';
            const expectedEventData = {channel_id: channel.id};
            expect(Client4.trackEvent).toHaveBeenCalledWith(expectedCategory, expectedEvent, expectedEventData);
        });
    });

    describe('updateChannelMemberRoles', () => {
        it('TODO', () => {

        });
    });

    describe('deleteChannel', () => {
        it('TODO', () => {

        });
    });

    describe('removeMeFromChannel', () => {
        it('TODO', () => {

        });
    });
});