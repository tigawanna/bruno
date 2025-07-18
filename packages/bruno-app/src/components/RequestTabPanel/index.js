import React, { useState, useEffect, useRef } from 'react';
import find from 'lodash/find';
import toast from 'react-hot-toast';
import { useSelector, useDispatch } from 'react-redux';
import GraphQLRequestPane from 'components/RequestPane/GraphQLRequestPane';
import HttpRequestPane from 'components/RequestPane/HttpRequestPane';
import ResponsePane from 'components/ResponsePane';
import Welcome from 'components/Welcome';
import { findItemInCollection } from 'utils/collections';
import { updateRequestPaneTabWidth } from 'providers/ReduxStore/slices/tabs';
import { sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import RequestNotFound from './RequestNotFound';
import QueryUrl from 'components/RequestPane/QueryUrl';
import NetworkError from 'components/ResponsePane/NetworkError';
import RunnerResults from 'components/RunnerResults';
import VariablesEditor from 'components/VariablesEditor';
import CollectionSettings from 'components/CollectionSettings';
import { DocExplorer } from '@usebruno/graphql-docs';

import StyledWrapper from './StyledWrapper';
import SecuritySettings from 'components/SecuritySettings';
import FolderSettings from 'components/FolderSettings';
import { getGlobalEnvironmentVariables, getGlobalEnvironmentVariablesMasked } from 'utils/collections/index';
import { produce } from 'immer';
import CollectionOverview from 'components/CollectionSettings/Overview';
import RequestNotLoaded from './RequestNotLoaded';
import RequestIsLoading from './RequestIsLoading';
import FolderNotFound from './FolderNotFound';

const MIN_LEFT_PANE_WIDTH = 300;
const MIN_RIGHT_PANE_WIDTH = 350;
const MIN_TOP_PANE_HEIGHT = 150;
const MIN_BOTTOM_PANE_HEIGHT = 150;

const RequestTabPanel = () => {
  if (typeof window == 'undefined') {
    return <div></div>;
  }
  const dispatch = useDispatch();
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const focusedTab = find(tabs, (t) => t.uid === activeTabUid);
  const { globalEnvironments, activeGlobalEnvironmentUid } = useSelector((state) => state.globalEnvironments);
  const _collections = useSelector((state) => state.collections.collections);
  const preferences = useSelector((state) => state.app.preferences);
  const isVerticalLayout = preferences?.layout?.responsePaneOrientation === 'vertical';

  // merge `globalEnvironmentVariables` into the active collection and rebuild `collections` immer proxy object
  let collections = produce(_collections, (draft) => {
    let collection = find(draft, (c) => c.uid === focusedTab?.collectionUid);

    if (collection) {
      // add selected global env variables to the collection object
      const globalEnvironmentVariables = getGlobalEnvironmentVariables({
        globalEnvironments,
        activeGlobalEnvironmentUid
      });
      const globalEnvSecrets = getGlobalEnvironmentVariablesMasked({ globalEnvironments, activeGlobalEnvironmentUid });
      collection.globalEnvironmentVariables = globalEnvironmentVariables;
      collection.globalEnvSecrets = globalEnvSecrets;
    }
  });

  let collection = find(collections, (c) => c.uid === focusedTab?.collectionUid);

  const screenWidth = useSelector((state) => state.app.screenWidth);
  let asideWidth = useSelector((state) => state.app.leftSidebarWidth);
  const [leftPaneWidth, setLeftPaneWidth] = useState(
    focusedTab && focusedTab.requestPaneWidth ? focusedTab.requestPaneWidth : (screenWidth - asideWidth) / 2.2
  ); // 2.2 is intentional to make both panes appear to be of equal width
  const [topPaneHeight, setTopPaneHeight] = useState(focusedTab?.requestPaneHeight || MIN_TOP_PANE_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Not a recommended pattern here to have the child component
  // make a callback to set state, but treating this as an exception
  const docExplorerRef = useRef(null);
  const mainSectionRef = useRef(null);
  const [schema, setSchema] = useState(null);
  const [showGqlDocs, setShowGqlDocs] = useState(false);
  const onSchemaLoad = (schema) => setSchema(schema);
  const toggleDocs = () => setShowGqlDocs((showGqlDocs) => !showGqlDocs);
  const handleGqlClickReference = (reference) => {
    if (docExplorerRef.current) {
      docExplorerRef.current.showDocForReference(reference);
    }
    if (!showGqlDocs) {
      setShowGqlDocs(true);
    }
  };

  useEffect(() => {
    // Initialize vertical heights when switching to vertical layout
    if (mainSectionRef.current) {
      const mainRect = mainSectionRef.current.getBoundingClientRect();
      if (isVerticalLayout) {
        const initialHeight = mainRect.height / 2;
        setTopPaneHeight(initialHeight);
        // In vertical mode, set leftPaneWidth to full container width
        setLeftPaneWidth(mainRect.width);
      } else {
        // In horizontal mode, set to roughly half width
        setLeftPaneWidth((screenWidth - asideWidth) / 2.2);
      }
    }
  }, [isVerticalLayout, screenWidth, asideWidth]);

  const handleMouseMove = (e) => {
    if (dragging && mainSectionRef.current) {
      e.preventDefault();
      const mainRect = mainSectionRef.current.getBoundingClientRect();

      if (isVerticalLayout) {
        const newHeight = e.clientY - mainRect.top - dragOffset.current.y;
        if (newHeight < MIN_TOP_PANE_HEIGHT || newHeight > mainRect.height - MIN_BOTTOM_PANE_HEIGHT) {
          return;
        }
        
        setTopPaneHeight(newHeight);
      } else {
        const newWidth = e.clientX - mainRect.left - dragOffset.current.x;
        if (newWidth < MIN_LEFT_PANE_WIDTH || newWidth > mainRect.width - MIN_RIGHT_PANE_WIDTH) {
          return;
        }
        setLeftPaneWidth(newWidth);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (dragging && mainSectionRef.current) {
      e.preventDefault();
      setDragging(false);
      if (!isVerticalLayout) {
        const mainRect = mainSectionRef.current.getBoundingClientRect();
        dispatch(
          updateRequestPaneTabWidth({
            uid: activeTabUid,
            requestPaneWidth: e.clientX - mainRect.left
          })
        );
      }
    }
  };

  const handleDragbarMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);

    if (isVerticalLayout) {
      const dragBar = e.currentTarget;
      const dragBarRect = dragBar.getBoundingClientRect();
      dragOffset.current.y = e.clientY - dragBarRect.top;
    } else {
      const dragBar = e.currentTarget;
      const dragBarRect = dragBar.getBoundingClientRect();
      dragOffset.current.x = e.clientX - dragBarRect.left;
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragging]);

  if (!activeTabUid) {
    return <Welcome />;
  }

  if (!focusedTab || !focusedTab.uid || !focusedTab.collectionUid) {
    return <div className="pb-4 px-4">An error occurred!</div>;
  }

  if (!collection || !collection.uid) {
    return <div className="pb-4 px-4">Collection not found!</div>;
  }

  if (focusedTab.type === 'collection-runner') {
    return <RunnerResults collection={collection} />;
  }

  if (focusedTab.type === 'variables') {
    return <VariablesEditor collection={collection} />;
  }

  if (focusedTab.type === 'collection-settings') {
    return <CollectionSettings collection={collection} />;
  }

  if (focusedTab.type === 'collection-overview') {
    return <CollectionOverview collection={collection} />;
  }

  if (focusedTab.type === 'folder-settings') {
    const folder = findItemInCollection(collection, focusedTab.folderUid);
    if (!folder) {
      return <FolderNotFound folderUid={focusedTab.folderUid} />;
    }
    
    return <FolderSettings collection={collection} folder={folder} />;
  }

  if (focusedTab.type === 'security-settings') {
    return <SecuritySettings collection={collection} />;
  }

  const item = findItemInCollection(collection, activeTabUid);
  if (!item || !item.uid) {
    return <RequestNotFound itemUid={activeTabUid} />;
  }

  if (item?.partial) {
    return <RequestNotLoaded item={item} collection={collection} />
  }

  if (item?.loading) {
    return <RequestIsLoading item={item} />
  }

  const handleRun = async () => {
    dispatch(sendRequest(item, collection.uid)).catch((err) =>
      toast.custom((t) => <NetworkError onClose={() => toast.dismiss(t.id)} />, {
        duration: 5000
      })
    );
  };

  return (
    <StyledWrapper className={`flex flex-col flex-grow relative ${dragging ? 'dragging' : ''} ${isVerticalLayout ? 'vertical-layout' : ''}`}>
      <div className="pt-4 pb-3 px-4">
        <QueryUrl item={item} collection={collection} handleRun={handleRun} />
      </div>
      <section ref={mainSectionRef} className={`main flex ${isVerticalLayout ? 'flex-col' : ''} flex-grow pb-4 relative`}>
        <section className="request-pane">
          <div
            className="px-4 h-full"
            style={isVerticalLayout ? {
              height: `${Math.max(topPaneHeight, MIN_TOP_PANE_HEIGHT)}px`,
              minHeight: `${MIN_TOP_PANE_HEIGHT}px`,
              width: '100%'
            } : {
              width: `${Math.max(leftPaneWidth, MIN_LEFT_PANE_WIDTH)}px`
            }}
          >
            {item.type === 'graphql-request' ? (
              <GraphQLRequestPane
                item={item}
                collection={collection}
                onSchemaLoad={onSchemaLoad}
                toggleDocs={toggleDocs}
                handleGqlClickReference={handleGqlClickReference}
              />
            ) : null}

            {item.type === 'http-request' ? (
              <HttpRequestPane item={item} collection={collection} />
            ) : null}
          </div>
        </section>

        <div className="dragbar-wrapper" onMouseDown={handleDragbarMouseDown}>
          <div className="dragbar-handle" />
        </div>

        <section className="response-pane flex-grow overflow-x-auto">
          <ResponsePane item={item} collection={collection} response={item.response} />
        </section>
      </section>

      {item.type === 'graphql-request' ? (
        <div className={`graphql-docs-explorer-container ${showGqlDocs ? '' : 'hidden'}`}>
          <DocExplorer schema={schema} ref={(r) => (docExplorerRef.current = r)}>
            <button className="mr-2" onClick={toggleDocs} aria-label="Close Documentation Explorer">
              {'\u2715'}
            </button>
          </DocExplorer>
        </div>
      ) : null}
    </StyledWrapper>
  );
};

export default RequestTabPanel;
