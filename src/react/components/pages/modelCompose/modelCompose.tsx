// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React from "react";
import {connect} from "react-redux";
import url from "url";
import _ from "lodash";
import { RouteComponentProps } from "react-router-dom";
import { IProject, IConnection, IAppSettings, IApplicationState } from "../../../../models/applicationState";
import { constants } from "../../../../common/constants";
import ServiceHelper from "../../../../services/serviceHelper";
import { IColumn,
         Fabric,
         DetailsList,
         Selection, SelectionMode,
         DetailsListLayoutMode, Customizer,
         ICustomizations,
         Spinner,
         SpinnerSize} from "office-ui-fabric-react";
import "./modelCompose.scss";
import { strings } from "../../../../common/strings";
import { getDarkGreyTheme, getDefaultDarkTheme } from "../../../../common/themes";
import { ModelComposeCommandBar } from "./composeCommandBar";
import { bindActionCreators } from "redux";
import IProjectActions, * as projectActions from "../../../../redux/actions/projectActions";
import IApplicationActions, * as applicationActions from "../../../../redux/actions/applicationActions";
import IAppTitleActions, * as appTitleActions from "../../../../redux/actions/appTitleActions";

export interface IModelComposePageProps extends RouteComponentProps, React.Props<ModelComposePage> {
    recentProjects: IProject[];
    connections: IConnection[];
    appSettings: IAppSettings;
    project: IProject;
    actions: IProjectActions;
    applicationActions: IApplicationActions;
    appTitleActions: IAppTitleActions;
}

export interface IModelComposePageState {
    modelList: IModel[];
    columns: IColumn[];
    selectionDetails: string;
    isModalSelection: boolean;
    isCompactMode: boolean;
    isComposing: boolean;
}

export interface IModel {
    modelId: string;
    createdDateTime: string;
    lastUpdatedDateTime: string;
    status: string;
}

function mapStateToProps(state: IApplicationState) {
    return {
        recentProjects: state.recentProjects,
        connections: state.connections,
        appSettings: state.appSettings,
        project: state.currentProject,
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators(projectActions, dispatch),
        applicationActions: bindActionCreators(applicationActions, dispatch),
        appTitleActions: bindActionCreators(appTitleActions, dispatch),
    };
}

@connect(mapStateToProps, mapDispatchToProps)
export default class ModelComposePage extends React.Component<IModelComposePageProps, IModelComposePageState> {
    private selection: Selection;

    constructor(props) {
        super(props);

        const columns: IColumn[] = [
            {
                key: "column1",
                name: "Model ID",
                fieldName: "modelId",
                minWidth: 100,
                isResizable: true,
                isRowHeader: true,
                isSorted: true,
                isSortedDescending: false,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                return <span>{model.modelId}</span>;
                },
            },
            {
                key: "column2",
                name: "Status",
                fieldName: "status",
                minWidth: 100,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                return (<span>{model.status}</span>);
                },
            },
            {
                key: "column3",
                name: "Create Date Time",
                fieldName: "createdatetime",
                minWidth: 200,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                    return <span>{new Date(model.createdDateTime).toLocaleString()}</span>;
                },
            },
            {
                key: "column4",
                name: "Last Updated Date Time",
                fieldName: "lastupdateddatetime",
                minWidth: 200,
                isResizable: true,
                onColumnClick: this.handleColumnClick,
                onRender: (model: IModel) => {
                    return (<span>{new Date(model.lastUpdatedDateTime).toLocaleString()}</span>);
                },
            },
        ];

        this.state = {
            modelList: [],
            columns,
            selectionDetails: this.handleSelection(),
            isModalSelection: false,
            isCompactMode: false,
            isComposing: false,
        };

        this.selection = new Selection({
            onSelectionChanged: () => {
              this.setState({
                selectionDetails: this.handleSelection(),
              });
            },
          });
    }

    public async componentDidMount() {
        const projectId = this.props.match.params["projectId"];
        if (projectId) {
            const project = this.props.recentProjects.find((project) => project.id === projectId);
            await this.props.actions.loadProject(project);
            this.props.appTitleActions.setTitle(project.name);
        }

        if (this.props.project) {
            this.getModelList();
        }
        document.title = "Model compose page - " + strings.appName;
    }

    public componentDidUpdate(prevProps, prevState) {
        if ( prevState.isComposing === true &&
                prevState.isComposing !== this.state.isComposing) {
            this.selection.setAllSelected(false);
            if (this.props.project) {
                this.getModelList();
            }
        }
    }

    public render() {
        const {modelList, isCompactMode, columns} = this.state;
        const dark: ICustomizations = {
            settings: {
              theme: getDarkGreyTheme(),
            },
            scopedSettings: {},
        };

        return (
            <Fabric>
                <Customizer {...dark}>
                    <div className="commandbar">
                        <ModelComposeCommandBar
                            handleCompose={this.onComposeClick}
                            />
                    </div>
                    {this.state.isComposing ?
                    <Spinner
                        label="Model is composing, please wait..."
                        className="compose-spinner"
                        theme={getDefaultDarkTheme()}
                        size={SpinnerSize.large}>
                    </Spinner> :
                    <DetailsList
                        items = {modelList}
                        compact={isCompactMode}
                        columns={columns}
                        selectionMode={SelectionMode.multiple}
                        layoutMode={DetailsListLayoutMode.justified}
                        isHeaderVisible={true}
                        selection={this.selection}
                        selectionPreservedOnEmptyClick={true}>
                    </DetailsList>
                    }
                </Customizer>
            </Fabric>
        );
    }

    private getModelList = async () => {
        try {
            const res = await this.getReponse();
            const modelList = res.data.modelList;
            this.setState({
                modelList,
            });
        } catch (error) {
            console.log(error);
        }
    }

    private async getReponse() {
        const baseURL = url.resolve(
            this.props.project.apiUriBase,
            constants.apiModelsPath,
        );

        try {
            return await ServiceHelper.getWithAutoRetry(
                baseURL,
                {},
                this.props.project.apiKey as string,
            );
        } catch (err) {
            ServiceHelper.handleServiceError(err);
        }
    }

    private handleColumnClick = (event: React.MouseEvent<HTMLElement>, column: IColumn): void => {
        const {columns, modelList} = this.state;
        const newColumns: IColumn[] = columns.slice();
        const currColumn: IColumn = newColumns.filter((col) => column.key === col.key)[0];
        newColumns.forEach((newCol: IColumn) => {
            if (newCol === currColumn) {
                currColumn.isSortedDescending = !currColumn.isSortedDescending;
                currColumn.isSorted = true;
            } else {
                newCol.isSorted = false;
                newCol.isSortedDescending = true;
            }
        });
        const newList = this.copyAndSort(modelList, currColumn.fieldName!, currColumn.isSortedDescending);
        this.setState({
            columns: newColumns,
            modelList: newList,
        });
    }

    private copyAndSort(modelList: IModel[], columnKey: string, isSortedDescending?: boolean): IModel[] {
        const key = columnKey;
        if (key === "createdatetime" || key === "lastupdateddatetime") {
            return (modelList.slice(0)
            .sort((a, b): number => {
                const cmp = (new Date(b.createdDateTime)).getTime() - (new Date(a.createdDateTime)).getTime();
                return isSortedDescending ? cmp : -cmp;
            }));
        } else {
            return (modelList.slice(0)
            .sort((a: IModel, b: IModel) => ((isSortedDescending ? a[key] < b[key] : a[key] > b[key]) ? 1 : -1 )));
        }
    }

    private handleSelection = (): string => {
        console.log("handle selection");
        return "item selected";
    }

    private onComposeClick = () => {
        this.selection.getSelection().map((s) => console.log(s));
        this.setState({
            isComposing: true,
        });
        this.handleModelCompose();
    }

    private handleModelCompose = () => {
        setTimeout( () => {
            this.setState({
                isComposing: false,
        });
        }, 5000);
    }
}
