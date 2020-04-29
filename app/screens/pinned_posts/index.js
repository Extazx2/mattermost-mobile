// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import {selectFocusedPostId, selectPost, loadThreadIfNecessary} from '@mm-redux/actions/posts';
import {clearSearch, getPinnedPosts} from '@mm-redux/actions/search';
import {getTheme} from '@mm-redux/selectors/entities/preferences';

import {getChannelsByTeamName} from '@actions/channels';
import {makePreparePostIdsForSearchPosts} from 'app/selectors/post_list';

import PinnedPosts from './pinned_posts';

function makeMapStateToProps() {
    const preparePostIds = makePreparePostIdsForSearchPosts();
    return (state, ownProps) => {
        const {pinned} = state.entities.search;
        const channelPinnedPosts = pinned[ownProps.currentChannelId] || [];
        const postIds = preparePostIds(state, channelPinnedPosts);

        return {
            postIds,
            theme: getTheme(state),
        };
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            clearSearch,
            getChannelsByTeamName,
            loadThreadIfNecessary,
            getPinnedPosts,
            selectFocusedPostId,
            selectPost,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PinnedPosts);
