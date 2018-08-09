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

Polymer({
  is: 'tf-data-selector',
  properties: {
    _allExperiments: {
      type: Array,
      value: (): Array<tf_backend.Experiment> => [],
    },

    _comparingExpsString: {
      type: String,
      value: tf_storage.getStringInitializer('e',
          {defaultValue: '', polymerProperty: '_comparingExpsString'}),
    },

    _comparingExps: {
      type: Array,
      computed: '_getComparingExps(_comparingExpsString, _allExperiments.*)',
    },

    // TODO(stephanwlee): Add list of active plugin from parent and filter out
    // the unused tag names in the list of selection.

    selection: {
      type: Array,
      notify: true,
      readOnly: true,
      value: (): Array<tf_data_selector.Selection> => ([]),
    },


    _selectionMap: {
      type: Object,
      value: (): Map<number, tf_data_selector.Selection> => new Map(),
    },

  },

  observers: [
    '_expStringObserver(_comparingExpsString)',
    '_pruneSelection(_selectionMap, _comparingExps)',
  ],

  attached() {
    this._updateExpKey = tf_backend.experimentsStore
        .addListener(() => this._updateExps());
    this._updateExps();
  },

  detached() {
    tf_backend.experimentsStore.removeListenerByKey(this._updateExpKey);
  },

  _updateExps() {
    this.set('_allExperiments', tf_backend.experimentsStore.getExperiments());
  },

  _getComparingExps() {
    const lookupMap = new Map(this._allExperiments.map(e => [e.id, e]));
    const ids = tf_data_selector.decodeIdArray(this._comparingExpsString);
    return ids.filter(id => lookupMap.has(id)).map(id => lookupMap.get(id));
  },

  _expStringObserver: tf_storage.getStringObserver('e',
      {defaultValue: '', polymerProperty: '_comparingExpsString'}),

  _canCompareExperiments(): boolean {
    return Boolean(this._comparingExps.length);
  },

  /**
   * Prunes away an experiment that has been removed from `_comparingExps` from
   * the _selectionMap.
   */
  _pruneSelection(): void {
    if (!this._canCompareExperiments()) {
      this._selectionMap.clear();
      return;
    }

    const comparingExpIds = new Set(this._comparingExps.map(({id}) => id));
    const curSelectedExpIds = Array.from(this._selectionMap.keys());
    curSelectedExpIds
        .filter(id => !comparingExpIds.has(id))
        .forEach(id => this._selectionMap.delete(id));

    this._setSelection(Array.from(this._selectionMap.values()));
  },

  _selectionChanged(event) {
    const {runs, tagRegex} = event.detail;

    if (!this._canCompareExperiments()) {
      this._setSelection([{runs, tagRegex}]);
      return;
    }

    const expId = event.target.experiment.id;
    this._selectionMap.set(expId, {
      experiment: this._comparingExps.find(({id}) => expId == id),
      runs,
      tagRegex,
    });
    this._setSelection(Array.from(this._selectionMap.values()));
  },

  _addExperiments(event) {
    const newExperiments = event.detail;
    const newComparingExpIds = this._comparingExps
        .concat(newExperiments).map(({id}) => id);
    this._comparingExpsString = tf_data_selector.encodeIdArray(
        newComparingExpIds);
  },

  _removeExperiment(event) {
    const expId = event.target.experiment.id;
    const newComparingExpIds = this._comparingExps
        .filter(({id}) => id != expId)
        .map(({id}) => id);
    this._comparingExpsString = tf_data_selector.encodeIdArray(
        newComparingExpIds);
  },

  _getExperimentColor(experiment: tf_backend.Experiment): string {
    return tf_color_scale.experimentsColorScale(experiment.name);
  },
});

}  // namespace tf_data_selector
