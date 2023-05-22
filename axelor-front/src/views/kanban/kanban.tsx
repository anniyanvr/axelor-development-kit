import { useAtom, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { atomWithImmer } from "jotai-immer";
import { uniq } from "lodash";
import { Box, Popper } from "@axelor/ui";
import isObject from "lodash/isObject";
import getValue from "lodash/get";
import setValue from "lodash/set";

import { dialogs } from "@/components/dialogs";
import { usePerms } from "@/hooks/use-perms";
import { SearchOptions, SearchPage } from "@/services/client/data";
import { DataContext, DataRecord } from "@/services/client/data.types";
import { i18n } from "@/services/client/i18n";
import { MetaData } from "@/services/client/meta";
import { KanbanView, Property } from "@/services/client/meta.types";
import { AdvanceSearch } from "@/view-containers/advance-search";
import { useDashletHandlerAtom } from "@/view-containers/view-dashlet/handler";
import { usePopupHandlerAtom } from "@/view-containers/view-popup/handler";
import { ViewToolBar } from "@/view-containers/view-toolbar";
import { EvalContextOptions } from "@/hooks/use-parser/eval-context";
import { useViewSwitch, useViewTab } from "@/view-containers/views/scope";
import { useEditor } from "@/hooks/use-relation";
import { useAsyncEffect } from "@/hooks/use-async-effect";
import { useHilites, useTemplate } from "@/hooks/use-parser";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useGridActionExecutor } from "../grid/builder/utils";
import { ViewProps } from "../types";
import { legacyClassNames } from "@/styles/legacy";

import { KanbanBoard } from "./kanban-board";
import { KanbanColumn, KanbanRecord } from "./types";
import {
  getColumnIndex,
  getColumnRecords,
  getRecordIndex,
  reorderCards,
} from "./utils";
import styles from "./kanban.module.scss";

const hasMorePage = ({
  offset = 0,
  limit = 20,
  totalCount = 0,
}: SearchPage) => {
  return offset + limit < totalCount;
};

export function Kanban(props: ViewProps<KanbanView>) {
  const { meta, dataStore, searchAtom } = props;
  const { view, fields } = meta;
  const { action, dashlet, popup, popupOptions } = useViewTab();
  const [columns, setColumns] = useAtom(
    useMemo(() => atomWithImmer<KanbanColumn[]>([]), [])
  );

  const { hasButton } = usePerms(meta.view, meta.perms);
  const showEditor = useEditor();
  const switchTo = useViewSwitch();

  const { params } = action;
  const { columnBy, editWindow, limit, sequenceBy } = view;
  const hasEditPopup = editWindow === "popup";
  const hasAddPopup = hasEditPopup || editWindow === "popup-new";
  const hideCols = params?.["kanban-hide-columns"] || "";
  const colWidth = params?.["kanban-column-width"];

  const getContext = useCallback(
    () =>
      ({
        ...action.context,
        _model: action.model,
        _viewName: action.name,
        _viewType: action.viewType,
        _views: action.views,
      } as DataContext),
    [action]
  );

  const getColumnByValue = useCallback(
    (value: any) => {
      const field = fields?.[columnBy ?? ""];
      return isObject(value) ? value : field?.target ? { id: value } : value;
    },
    [fields, columnBy]
  );

  const $columns = useMemo(() => {
    const $columns = (view.columns ||
      fields?.[columnBy ?? ""]?.selectionList ||
      []) as KanbanColumn[];
    if (view.onNew && $columns[0]) {
      $columns[0].canCreate = true;
    }
    return $columns;
  }, [view, columnBy, fields]);

  const fetchRecords = useAtomCallback(
    useCallback(
      (get, set, value: any, options: Partial<SearchOptions> = {}) => {
        const { query = null } = searchAtom ? get(searchAtom) : {};
        const names = Object.keys(fields ?? {});

        let filter: SearchOptions["filter"] = {
          criteria: [
            {
              fieldName: columnBy,
              operator: "=",
              value: getColumnByValue(value),
            },
          ],
          operator: "and",
        };

        if (query) {
          filter = {
            ...query,
            operator: "and",
            criteria: [query, filter],
          };
        }

        return dataStore.search({
          ...(sequenceBy && { sortBy: [sequenceBy] }),
          filter,
          limit,
          fields: uniq(
            [...names, columnBy, sequenceBy].filter((name) => name)
          ) as string[],
          ...options,
        });
      },
      [
        dataStore,
        fields,
        searchAtom,
        limit,
        columnBy,
        sequenceBy,
        getColumnByValue,
      ]
    )
  );

  const onSearch = useCallback(
    (options: Partial<SearchOptions> = {}): any => {
      const hideColumns = hideCols.split(",");
      const columns = ($columns || [])
        .filter((item) => !hideColumns.includes(item.value))
        .map(({ value: name, title, canCreate, collapsed }: any) => ({
          id: name,
          name,
          title,
          collapsed,
          canCreate,
          loading: true,
          records: [],
        }));

      setColumns(columns);

      columns.map((column: any, index: number) =>
        fetchRecords(column.name, options).then(({ page, records }) => {
          setColumns((draft) => {
            const column = draft[index];
            if (column) {
              column.loading = false;
              column.records = records as KanbanRecord[];
              column.hasMore = hasMorePage(page);
            }
          });
        })
      );
    },
    [hideCols, setColumns, $columns, fetchRecords]
  );

  const onRefresh = useCallback(() => {
    return onSearch({ offset: 0 });
  }, [onSearch]);

  const onLoadMore = useCallback(
    ({ column: { name, records } }: { column: KanbanColumn }) => {
      fetchRecords(name, { offset: records?.length ?? 0 }).then(
        ({ page, records }) => {
          setColumns((columns) => {
            const columnIndex = columns.findIndex((c) => c.name === name);
            if (columns[columnIndex]) {
              columns[columnIndex].records?.push(
                ...(records as KanbanRecord[])
              );
              columns[columnIndex].hasMore = hasMorePage(page);
            }
          });
        }
      );
    },
    [fetchRecords, setColumns]
  );

  const onDelete = useCallback(
    async ({
      record,
      column,
    }: {
      record: KanbanRecord;
      column: KanbanColumn;
    }) => {
      const confirmed = await dialogs.confirm({
        content: i18n.get(
          "Do you really want to delete the selected record(s)?"
        ),
        yesTitle: i18n.get("Delete"),
      });
      if (confirmed) {
        const { id, version } = record as DataRecord;
        try {
          const removed = await dataStore.delete([
            { id: id!, version: version! },
          ]);
          removed &&
            setColumns((columns) => {
              const state = columns.find((c) => c.name === column.name);
              state &&
                (state.records = state.records?.filter((r) => r.id !== id));
            });
        } catch {}
      }
    },
    [dataStore, setColumns]
  );

  const onEdit = useCallback(
    ({ record }: { record: KanbanRecord }, readonly = false) => {
      const recordId = (record.id || 0) as number;
      const id = recordId > 0 ? String(recordId) : "";
      switchTo("form", {
        route: { id },
        props: { readonly },
      });
    },
    [switchTo]
  );

  const onEditInPopup = useCallback(
    ({ record }: { record: KanbanRecord }, readonly = false) => {
      const viewName = action.views?.find((v) => v.type === "form")?.name;
      const { title, model } = view;
      model &&
        showEditor({
          title: title ?? "",
          model,
          viewName,
          record: record as DataRecord,
          readonly,
          onSelect: () => onRefresh(),
        });
    },
    [showEditor, view, action, onRefresh]
  );

  const onNew = useCallback(() => {
    hasAddPopup
      ? onEditInPopup({ record: {} as KanbanRecord })
      : onEdit({ record: {} as KanbanRecord });
  }, [hasAddPopup, onEdit, onEditInPopup]);

  const actionExecutor = useGridActionExecutor(view, {
    getContext,
    onRefresh,
  });

  const onCreate = useCallback(
    async ({
      record,
      column,
    }: {
      record: KanbanRecord;
      column: KanbanColumn;
    }) => {
      if (view.onNew && record && column) {
        const res = await actionExecutor.execute(view.onNew, {
          data: {
            _domainContext: {
              ...getContext(),
              _value: (record as DataRecord).text,
            },
          },
        });
        const values = res?.reduce?.(
          (obj, { values }) => ({
            ...obj,
            ...values,
          }),
          {}
        );
        if (values) {
          const record = {
            ...values,
            [columnBy!]: getColumnByValue(column.name),
          };
          const saved = await dataStore.save(record);
          saved &&
            setColumns((columns) => {
              const state = columns.find((c) => c.name === column.name);
              state &&
                (state.records = [
                  saved as KanbanRecord,
                  ...(state.records || []),
                ]);
            });
        }
      }
    },
    [
      getContext,
      getColumnByValue,
      actionExecutor,
      setColumns,
      dataStore,
      columnBy,
      view,
    ]
  );

  const onView = useCallback(
    ({ record }: { record: KanbanRecord }) => {
      hasEditPopup ? onEditInPopup({ record }, true) : onEdit({ record }, true);
    },
    [hasEditPopup, onEdit, onEditInPopup]
  );

  const onMove = useCallback(
    async ({
      column,
      index,
      source,
      record,
    }: {
      column: KanbanColumn;
      index: number;
      source: KanbanColumn;
      record: KanbanRecord;
    }) => {
      function getRecord(
        _record: DataRecord,
        columnByValue: any,
        sequenceByValue: any
      ) {
        const { id, version } = _record;
        const record: any = { id, version };
        const columnByJSONField = fields?.[columnBy ?? ""]?.jsonField;
        const sequenceByJSONField = fields?.[sequenceBy ?? ""]?.jsonField;

        if (columnByJSONField) {
          record[columnByJSONField] = _record[columnByJSONField];
        }
        if (sequenceByJSONField) {
          record[sequenceByJSONField] = _record[sequenceByJSONField];
        }

        columnBy && setValue(record, columnBy, getColumnByValue(columnByValue));
        sequenceBy && setValue(record, sequenceBy, sequenceByValue);

        return record;
      }

      const updatedColumns = reorderCards({
        columns,
        destinationColumn: column,
        destinationIndex: index,
        sourceColumn: source,
        sourceIndex: getRecordIndex(
          record.id,
          getColumnRecords(columns, source.name)
        ),
      }).slice();

      setColumns(updatedColumns);

      const records = [
        ...(updatedColumns[getColumnIndex(updatedColumns, column.name)]
          ?.records || []),
      ];
      const previousRecord = records[index - 1];
      const updatedRecord = getRecord(
        records[index] as DataRecord,
        column.name,
        Number(
          previousRecord
            ? parseInt(getValue(previousRecord, sequenceBy!) + 1)
            : 0
        )
      );

      if (view.onMove) {
        const ctx = {
          ...getContext(),
          ...updatedRecord,
        };
        await actionExecutor.execute(view.onMove, {
          context: ctx,
          data: {
            _domainContext: ctx,
          },
        });
      }
      const updatedRecords = [
        updatedRecord,
        ...records.slice(index + 1, records.length).map((record, i) => {
          const $sequenceBy = getValue(updatedRecord, sequenceBy!);
          return getRecord(
            record as DataRecord,
            getValue(record, columnBy!),
            $sequenceBy === null ? null : parseInt($sequenceBy) + i + 1
          );
        }),
      ];

      try {
        const res = await dataStore.save(updatedRecords);

        records.splice(index, res.length, ...(res as KanbanRecord[]));

        const colInd = getColumnIndex(updatedColumns, column.name);

        /**
         * Setting same reference with mutation of records with updated sequence and versioning
         */
        setColumns(
          updatedColumns.map((col, ind) =>
            ind === colInd ? { ...col, records: [...records] } : col
          )
        );
      } catch {
        onRefresh();
      }
    },
    [
      view,
      columnBy,
      sequenceBy,
      columns,
      actionExecutor,
      fields,
      dataStore,
      getColumnByValue,
      getContext,
      setColumns,
      onRefresh,
    ]
  );

  const setPopupHandlers = useSetAtom(usePopupHandlerAtom());
  const setDashletHandlers = useSetAtom(useDashletHandlerAtom());

  useEffect(() => {
    if (popup) {
      setPopupHandlers({
        dataStore: dataStore,
        onSearch: onRefresh,
      });
    }
  }, [onRefresh, popup, dataStore, setPopupHandlers]);

  useEffect(() => {
    if (dashlet) {
      setDashletHandlers({
        dataStore,
        view,
        onRefresh: () => onRefresh(),
      });
    }
  }, [dashlet, view, dataStore, onRefresh, setDashletHandlers]);

  useAsyncEffect(async () => {
    await onRefresh();
  }, [onRefresh]);

  const showToolbar = popupOptions?.showToolbar !== false;
  const small = useMediaQuery("(max-width: 768px)");

  const hasValidSequenceByField = useMemo(() => {
    const $sequenceBy = (fields?.[sequenceBy ?? ""] || {}) as Property;
    if (
      ["integer", "long"].indexOf(($sequenceBy?.type ?? "").toLowerCase()) ===
        -1 ||
      ["id", "version"].indexOf($sequenceBy?.name ?? "") > -1
    ) {
      return false;
    }
    return true;
  }, [fields, sequenceBy]);

  const Template = useTemplate(view.template || "");

  const components = useMemo(
    () => ({
      Card: ({ record }: { record: KanbanRecord }) => (
        <KanbanCard
          view={view}
          fields={fields}
          record={record}
          Template={Template}
        />
      ),
    }),
    [view, fields, Template]
  );

  return (
    <Box
      className={legacyClassNames(styles.kanban, "kanban-view", "row-fluid")}
    >
      {showToolbar && (
        <ViewToolBar
          meta={meta}
          actionExecutor={actionExecutor}
          actions={[
            {
              key: "new",
              text: i18n.get("New"),
              hidden: !hasButton("new"),
              iconProps: {
                icon: "add",
              },
              onClick: onNew,
            },
            {
              key: "refresh",
              text: i18n.get("Refresh"),
              iconProps: {
                icon: "refresh",
              },
              onClick: () => onRefresh(),
            },
          ]}
        >
          {searchAtom && (
            <AdvanceSearch
              stateAtom={searchAtom}
              dataStore={dataStore}
              items={view.items}
              customSearch={view.customSearch}
              freeSearch={view.freeSearch}
              onSearch={onRefresh}
            />
          )}
        </ViewToolBar>
      )}
      <Box
        d="flex"
        flexGrow={1}
        overflow={small ? "auto" : "hidden"}
        className={styles["board"]}
      >
        <KanbanBoard
          readonly={view.draggable === false || !hasValidSequenceByField}
          responsive={small}
          columnWidth={colWidth}
          columns={columns}
          components={components as any}
          onLoadMore={onLoadMore}
          onCardMove={onMove}
          onCardClick={onView}
          {...(hasButton("delete") && { onCardDelete: onDelete })}
          {...(hasButton("new") && { onCardAdd: onCreate })}
          {...(hasButton("edit") && {
            onCardEdit: hasEditPopup ? onEditInPopup : onEdit,
          })}
          {...({} as any)}
        />
      </Box>
    </Box>
  );
}

function KanbanCard({
  view,
  fields,
  record,
  Template,
}: {
  record?: KanbanRecord;
  view: KanbanView;
  fields?: MetaData["fields"];
  Template: FunctionComponent<{
    context: DataContext;
    options?: EvalContextOptions;
  }>;
}) {
  const { template: templateString, hilites } = view;
  const divRef = useRef<any>(null);
  const className = useHilites(hilites ?? [])(record as DataContext)?.[0]
    ?.color;
  const timer = useRef<any>();
  const [popover, setPopover] = useState(false);
  const [popoverData, setPopoverData] = useState<{ title: ""; body: "" }>({
    title: "",
    body: "",
  });

  function showPopover() {
    const div = divRef.current;
    const summary =
      div &&
      div.querySelector(
        `.${legacyClassNames("card-summary")}.${legacyClassNames("popover")}`
      );
    if (summary) {
      const text = (summary.textContent || "").trim();
      if (text) {
        timer.current = setTimeout(() => {
          setPopover(true);
          setPopoverData({
            title: summary.title,
            body: summary.innerHTML,
          });
        }, 500);
      }
    }
  }

  const hidePopover = useCallback(function hidePopover() {
    setPopover(false);
    clearTimeout(timer.current);
  }, []);

  const hasPopover = (templateString || "").includes("popover");

  useEffect(() => {
    return () => hidePopover();
  }, [hidePopover]);

  return (
    <>
      <Box
        ref={divRef}
        {...(hasPopover
          ? {
              onMouseEnter: showPopover,
              onMouseLeave: hidePopover,
              onMouseDown: hidePopover,
            }
          : {})}
        className={legacyClassNames(
          "kanban-card",
          styles["kanban-card"],
          className
        )}
      >
        <Template
          context={record as DataRecord}
          options={{ fields: fields as any }}
        />
      </Box>

      <Popper
        arrow
        bg={"white" as any}
        placement="end"
        open={popover}
        target={divRef.current}
        offset={[0, 4]}
      >
        <Box
          className={legacyClassNames("card")}
          p={2}
          style={{
            maxWidth: 400,
            minWidth: 200,
          }}
        >
          {popoverData.title && (
            <Box className={legacyClassNames("card-header")}>
              {popoverData.title}
            </Box>
          )}
          <Box className={legacyClassNames("card-body")} rounded>
            {popoverData.body && (
              <div
                dangerouslySetInnerHTML={{ __html: popoverData.body } as any}
              />
            )}
          </Box>
        </Box>
      </Popper>
    </>
  );
}
