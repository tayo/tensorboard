/* Copyright 2018 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
namespace tf_data_selector {

enum Type {
  RUN = 1,
  TAG,
}

Polymer({
  is: 'tf-data-select-row',
  properties: {
    experiment: {
      type: Object,
      value: () => ({
        id: null,
        name: 'Unknown experiment',
        startTime: null,
      }),
    },

    enabled: {
      type: Boolean,
      notify: true,
      value: true,
    },

    checkboxColor: {
      type: String,
      value: '',
    },

    // Required field.
    persistenceNumber: Number,

    noExperiment: {
      type: Boolean,
      value: false,
    },

    _runs: {
      type: Array,
      value: (): Array<tf_backend.Run> => [],
    },

    _runSelectionStateString: {type: String, value: ''},

    _selectedRuns: {
      type: Array,
      value: (): Array<tf_dashboard_common.FilterableCheckboxListItem> => [],
    },

    _tagRegex: {
      type: String,
      value: '',
      observer: '_persistRegex',
    },
  },

  listeners: {
    'dom-change': '_synchronizeColors',
  },

  observers: [
    '_persistSelectedRuns(_selectedRuns)',
    '_fireChange(_selectedRuns, _tagRegex)',
  ],

  _getPersistenceKey(type: Type): string {
    const number = this.persistenceNumber || 0;
    switch (type) {
      case Type.RUN:
        // Prefix with 'g' to denote a group.
        return `g${number}r`;
      case Type.TAG:
        return `g${number}t`;
    }
  },

  ready(): void {
    if (this.persistenceNumber == null) return;

    const runInitializer = tf_storage.getStringInitializer(
        this._getPersistenceKey(Type.RUN),
        {defaultValue: '', polymerProperty: '_runSelectionStateString'});
    runInitializer.call(this);

    const tagInitializer = tf_storage.getStringInitializer(
        this._getPersistenceKey(Type.TAG),
        {defaultValue: '', polymerProperty: '_tagRegex'});
    tagInitializer.call(this);
  },

  attached(): void {
    this._fetchRunsAndTags().then(() => this._isDataReady = true);
  },

  _synchronizeColors() {
    const cb = this.$$('#checkbox');
    if (!cb) return;

    const color = this.checkboxColor;
    cb.customStyle['--paper-checkbox-checked-color'] = color;
    cb.customStyle['--paper-checkbox-checked-ink-color'] = color;
    cb.customStyle['--paper-checkbox-unchecked-color'] = color;
    cb.customStyle['--paper-checkbox-unchecked-ink-color'] = color;

    window.requestAnimationFrame(() => this.updateStyles());
  },

  detached(): void {
    this._isDataReady = false;
  },

  _fetchRunsAndTags(): Promise<void> {
    const requestManager = new tf_backend.RequestManager();
    if (this.noExperiment) {
      const fetchRuns = requestManager.request(tf_backend.getRouter().runs());
      return Promise.all([fetchRuns]).then(([runs]) => {
        this.set('_runs', Array.from(new Set(runs)).map(runName => ({
          id: null,
          name: runName,
          startedTime: null,
        })));
      });
    } else if (this.experiment.id) {
      const url = tf_backend.getRouter().runsForExperiment(this.experiment.id);
      return requestManager.request(url).then(runs => {
        this.set('_runs', runs);
      });
    }
  },

  _getRunOptions(_): Array<tf_dashboard_common.FilterableCheckboxListItem> {
    return this._runs.map(run => ({
      // /data/runs endpoint does not return ids. In case of logdir data source,
      // runs cannot have an id and, for filtered-checkbox-list, we need to
      // synthesize id from the name.
      id: this.noExperiment ? run.name : run.id,
      title: run.name,
    }));
  },

  _getIsRunCheckboxesColored(_): boolean {
    return this.noExperiment;
  },

  _persistSelectedRuns(): void {
    if (!this._isDataReady) return;
    const value = this._serializeValue(
        this._runs, this._selectedRuns.map(({id}) => id));
    tf_storage.setString(this._getPersistenceKey(Type.RUN), value,
        {defaultValue: ''});
  },

  _getRunsSelectionState(): Object {
    const allIds = this._runs.map(({id}) => id);
    const ids = this._deserializeValue(this._runSelectionStateString, allIds);
    const prevSelection = new Set(ids);
    const newSelection = {};
    allIds.forEach(id => newSelection[id] = prevSelection.has(id));
    return newSelection;
  },

  _persistRegex(): void {
    if (!this._isDataReady) return;
    const value = this._tagRegex;
    tf_storage.setString(this._getPersistenceKey(Type.TAG), value,
        {defaultValue: ''});
  },

  _fireChange(_, __): void {
    const runMap = new Map(this._runs.map(run => [run.id, run]));
    this.fire('selection-changed', {
      runs: this._selectedRuns.map(({id}) => runMap.get(id))
          .filter(Boolean)
          .map(run => ({
            id: this.noExperiment ? null : run.id,
            name: run.name,
            startTime: run.startTime,
            tags: run.tags,
          })),
      tagRegex: this._tagRegex,
    });
  },

  _removeRow(): void {
    this.fire('remove');
  },

  _serializeValue(
      source: Array<number|string>, selectedIds: Array<number|string>) {
    if (selectedIds.length == source.length) return '$all';
    if (selectedIds.length == 0) return '$none';

    // TODO(stephanwlee): Consider populating ids for /data/runs endpoint.
    return this.noExperiment ?
        selectedIds.join(',') :
        tf_data_selector.encodeIdArray((selectedIds as Array<number>));
  },

  _deserializeValue(str: string, allValues: Array<number|string>) {
    if (str == '$all') return allValues;
    if (str == '$none') return [];
    return this.noExperiment ?
        str.split(',') :
        tf_data_selector.decodeIdArray(str);
  },
});

}  // namespace tf_data_selector
