const React = require('react');
const ReactNative = require('react-native');
const {TextInput, View, ListView, Image, Text, Dimensions, TouchableHighlight, TouchableWithoutFeedback, Platform, ActivityIndicator, ProgressBarAndroid, PixelRatio} = ReactNative;
const Qs = require('qs');

const GooglePlacesAutocomplete = React.createClass({

  propTypes: {
    placeholder: React.PropTypes.string,
    onPress: React.PropTypes.func,
    minLength: React.PropTypes.number,
    fetchDetails: React.PropTypes.bool,
    autoFocus: React.PropTypes.bool,
    getDefaultValue: React.PropTypes.func,
    timeout: React.PropTypes.number,
    onTimeout: React.PropTypes.func,
    query: React.PropTypes.object,
    GoogleReverseGeocodingQuery: React.PropTypes.object,
    GooglePlacesSearchQuery: React.PropTypes.object,
    styles: React.PropTypes.object,
    textInputProps: React.PropTypes.object,
    enablePoweredByContainer: React.PropTypes.bool,
    predefinedPlaces: React.PropTypes.array,
    currentLocation: React.PropTypes.bool,
    currentLocationLabel: React.PropTypes.string,
    nearbyPlacesAPI: React.PropTypes.string,
    filterReverseGeocodingByTypes: React.PropTypes.array,
    predefinedPlacesAlwaysVisible: React.PropTypes.bool,
    backArrowUnderlayColor: React.PropTypes.any,
    activityIndicatorColor: React.PropTypes.any,
  },

  getDefaultProps() {
    return {
      placeholder: 'Search',
      onPress: () => {},
      minLength: 0,
      fetchDetails: false,
      autoFocus: false,
      getDefaultValue: () => '',
      timeout: 20000,
      onTimeout: () => console.warn('google places autocomplete: request timeout'),
      query: {
        key: 'missing api key',
        language: 'en',
        types: 'geocode',
      },
      GoogleReverseGeocodingQuery: {
      },
      GooglePlacesSearchQuery: {
        rankby: 'distance',
        types: 'food',
      },
      styles: {
      },
      textInputProps: {},
      enablePoweredByContainer: true,
      predefinedPlaces: [],
      currentLocation: false,
      currentLocationLabel: 'Current location',
      nearbyPlacesAPI: 'GooglePlacesSearch',
      filterReverseGeocodingByTypes: [],
      predefinedPlacesAlwaysVisible: false,
    };
  },

  getInitialState() {
    const ds = new ListView.DataSource({rowHasChanged: function rowHasChanged(r1, r2) {
      if (typeof r1.isLoading !== 'undefined') {
        return true;
      }
      return r1 !== r2;
    }});
    return {
      text: this.props.initialText,
      dataSource: ds.cloneWithRows(this.buildRowsFromResults([])),
      listViewDisplayed: false,
      loadingResults: false,
    };
  },

  buildRowsFromResults(results) {
    var res = null;

    if (results.length === 0 || this.props.predefinedPlacesAlwaysVisible === true) {
      res = [...this.props.predefinedPlaces];
      if (this.props.currentLocation === true) {
        res.unshift({
          description: this.props.currentLocationLabel,
          isCurrentLocation: true,
        });
      }
    } else {
      res = [];
    }

    res = res.map(function(place) {
      return {
        ...place,
        isPredefinedPlace: true,
      }
    });

    return [...res, ...results];
  },

  componentWillUnmount() {
    this._abortRequests();
  },

  _abortRequests() {
    for (let i = 0; i < this._requests.length; i++) {
      this._requests[i].abort();
    }
    this._requests = [];
  },

  /**
   * This method is exposed to parent components to focus on textInput manually.
   * @public
   */
  triggerFocus() {
    if (this.refs.textInput) this.refs.textInput.focus();
  },

  /**
   * This method is exposed to parent components to blur textInput manually.
   * @public
   */
  triggerBlur() {
    if (this.refs.textInput) this.refs.textInput.blur();
  },

  _enableRowLoader(rowData) {

    let rows = this.buildRowsFromResults(this._results);
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i].place_id === rowData.place_id) || (rows[i].isCurrentLocation === true && rowData.isCurrentLocation === true)) {
        rows[i].isLoading = true;
        this.setState({
          dataSource: this.state.dataSource.cloneWithRows(rows),
        });
        break;
      }
    }
  },
  _disableRowLoaders() {
    if (this.isMounted()) {
      for (let i = 0; i < this._results.length; i++) {
        if (this._results[i].isLoading === true) {
          this._results[i].isLoading = false;
        }
      }
      this.setState({
        dataSource: this.state.dataSource.cloneWithRows(this.buildRowsFromResults(this._results)),
      });
    }
  },
  _onPress(rowData) {

    if(rowData.customLocation) {
      const lastIndex = rowData.description.lastIndexOf(',');
      let formatted_address = rowData.description;

      if (rowData.description.substring(lastIndex) === ', Create Custom Project') {
        formatted_address = rowData.description.substring(0, lastIndex);
      }

      formatted_address = formatted_address.concat(', , ');

      details= {
        name: "",
        formatted_address,
      }

      this.props.onPress(rowData, details);
    }


    if (rowData.isPredefinedPlace !== true && this.props.fetchDetails === true) {
      if (rowData.isLoading === true) {
        // already requesting
        return;
      }

      this._abortRequests();

      // display loader
      this._enableRowLoader(rowData);

      // fetch details
      const request = new XMLHttpRequest();
      this._requests.push(request);
      request.timeout = this.props.timeout;
      request.ontimeout = this.props.onTimeout;
      request.onreadystatechange = () => {
        if (request.readyState !== 4) {
          return;
        }
        if (request.status === 200) {
          const responseJSON = JSON.parse(request.responseText);
          if (responseJSON.status === 'OK') {
            if (this.isMounted()) {
              const details = responseJSON.result;
              this._disableRowLoaders();
              this._onBlur();

              this.setState({
                text: rowData.description,
              });

              delete rowData.isLoading;
              this.props.onPress(rowData, details);
            }
          } else {
            this._disableRowLoaders();
            console.warn('google places autocomplete: ' + responseJSON.status);
          }
        } else {
          this._disableRowLoaders();
          console.warn('google places autocomplete: request could not be completed or has been aborted');
        }
      };
      request.open('GET', 'https://maps.googleapis.com/maps/api/place/details/json?' + Qs.stringify({
        key: this.props.query.key,
        placeid: rowData.place_id,
        language: this.props.query.language,
      }));
      request.send();
    } else {
      this.setState({
        text: rowData.description,
      });

      this._onBlur();

      delete rowData.isLoading;

      let predefinedPlace = this._getPredefinedPlace(rowData);

      // sending predefinedPlace as details for predefined places
      this.props.onPress(predefinedPlace, predefinedPlace);
    }
  },
  _results: [],
  _requests: [],
  _previousResults: [],

  _getPredefinedPlace(rowData) {
    if (rowData.isPredefinedPlace !== true) {
      return rowData;
    }
    for (let i = 0; i < this.props.predefinedPlaces.length; i++) {
      if (this.props.predefinedPlaces[i].description === rowData.description) {
        return this.props.predefinedPlaces[i];
      }
    }
    return rowData;
  },

  _filterResultsByTypes(responseJSON, types) {
    if (types.length === 0) return responseJSON.results;

    var results = [];
    for (let i = 0; i < responseJSON.results.length; i++) {
      let found = false;
      for (let j = 0; j < types.length; j++) {
        if (responseJSON.results[i].types.indexOf(types[j]) !== -1) {
          found = true;
          break;
        }
      }
      if (found === true) {
        results.push(responseJSON.results[i]);
      }
    }
    return results;
  },


  _request(text) {
    this._abortRequests();

    let description = text;

    // this will render the previous results, with the new 'text' value in customLocationRow
    // which will be displayed until the google results return
    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(
        this.buildRowsFromResults([...this._previousResults])
      ),
    });

    if (text.length >= this.props.minLength) {
      this.setState({ loadingResults: true });
      const request = new XMLHttpRequest();
      this._requests.push(request);
      request.timeout = this.props.timeout;
      request.ontimeout = this.props.onTimeout;
      request.onreadystatechange = () => {
        if (request.readyState !== 4) {
          return;
        }

        if (request.status === 200) {
          const responseJSON = JSON.parse(request.responseText);
          if (typeof responseJSON.predictions !== 'undefined') {
            if (this.isMounted()) {
              this._results = responseJSON.predictions;

              this.setState({
                dataSource: this.state.dataSource.cloneWithRows(this.buildRowsFromResults(responseJSON.predictions)),
              });
              this.setState({ loadingResults: false });
            }
          }
          if (typeof responseJSON.error_message !== 'undefined') {
            console.warn('google places autocomplete: ' + responseJSON.error_message);
            this.setState({ loadingResults: false });
          }
        } else {
          // no reponse from google
          this._previousResults = [];
          this.setState({ loadingResults: false });
        }
      };
      request.open('GET', 'https://maps.googleapis.com/maps/api/place/autocomplete/json?&input=' + encodeURI(text) + '&' + Qs.stringify(this.props.query));
      request.send();
    }
  },
  _onChangeText(text) {
    this._previousResults = this._results;
    this._request(text);
    this.setState({
      text: text,
      listViewDisplayed: true,
    });
  },

  _renderRow(rowData = {}) {
    let myStyles = this.props.styles;

    rowData.description = rowData.description || rowData.formatted_address || rowData.name;
    var descriptionSplit = rowData.description.split(/, (.+)?/); // Split only at first comma

    return (
      <TouchableHighlight
        onPress={() => this._onPress(rowData)}
        underlayColor={this.props.rowUnderlayColor}
      >
          <View style={myStyles.row}>
            <View style={myStyles.leftModule}>

            <Text style={myStyles.description1} numberOfLines={1}>
              {descriptionSplit[0]}
            </Text>
            <Text style={myStyles.description2} numberOfLines={1}>
              {descriptionSplit[1]}
            </Text>
          </View>

          <View style={myStyles.rowImageWrapper}>
            <Image style={myStyles.rowImage} source={this.props.rowImage}/>
          </View>

        </View>
      </TouchableHighlight>
    );
  },

  _onBlur() {
    this.triggerBlur();
    this.setState({listViewDisplayed: false});
  },

  _onFocus() {
    this.setState({listViewDisplayed: true});
  },



  _getCustomLocationButton() {
    if (this.state.text !== '') {
      const customLocationData = {
        description: this.state.text,
        customLocation: true,
      }
      const myStyles = this.props.styles;

      return (
        <TouchableHighlight
          onPress={() => this._onPress(customLocationData)}
          underlayColor={this.props.rowUnderlayColor}
        >
          <View style={myStyles.customLocationRow}>
            <View style={myStyles.customLocationLeftModule}>
              <Text
                style={myStyles.customLocationDescription1}
                numberOfLines={1}
              >
                {this.state.text}
              </Text>
              <Text
                style={myStyles.customLocationDescription2}
                numberOfLines={1}
              >
                Create Custom Location
              </Text>
            </View>

            <View style={myStyles.customLocationRowImageWrapper}>
              <Image style={myStyles.customLocationRowImage}
                source={this.props.customLocationRowImage}
                />
            </View>
          </View>
        </TouchableHighlight>
      );
    }
    return;
  },

  _getListView() {
    if ((this.state.text !== '' || this.props.predefinedPlaces.length) && this.state.listViewDisplayed === true) {
      let myStyles = this.props.styles;
      return (
        <View>
          {
            this.state.loadingResults &&
            <View style={myStyles.listFooterView}>
              <ActivityIndicator animating color={this.props.activityIndicatorColor} />
            </View>
          }
          <ListView
            keyboardShouldPersistTaps={true}
            keyboardDismissMode="on-drag"
            style={this.props.styles.listView}
            dataSource={this.state.dataSource}
            renderRow={this._renderRow}
            automaticallyAdjustContentInsets={false}

            {...this.props}
          />
          {
            !this.state.loadingResults && this.state.dataSource.getRowCount() === 0 &&
            <View style={[myStyles.listFooterView, { marginTop: 20 }]}>
              <Text style={myStyles.noResultsText}>
                No Google results available
              </Text>
            </View>
          }
          <View
            style={myStyles.poweredLogoContainer}
          >
            <Image
              style={myStyles.poweredLogo}
              resizeMode={Image.resizeMode.contain}
              source={require('./images/powered_by_google_on_white.png')}
            />
          </View>
        </View>
      );
    }

    if(this.props.enablePoweredByContainer) {
      return (
        <View
          style={this.props.styles.poweredLogoContainer}
        >
          <Image
            style={this.props.styles.poweredLogo}
            resizeMode={Image.resizeMode.contain}
            source={require('./images/powered_by_google_on_white.png')}
          />
        </View>
      );
    }

    return null;
  },
  render() {
    let {
      showBackArrow,
      actionOnBack,
      backArrowImage,
      onChangeText,
      onFocus,
      ...userProps
    } = this.props.textInputProps;

    return (
      <View
        style={this.props.styles.container}
      >
        <View
          style={this.props.styles.textInputContainer}
        >
          <TouchableHighlight
            style={this.props.styles.backArrowContainer}
            onPress={actionOnBack}
            underlayColor={this.props.backArrowUnderlayColor}
          >
            <Image source={backArrowImage} style={this.props.styles.backArrow} />
          </TouchableHighlight>
          <TextInput
            { ...userProps }
            ref="textInput"
            autoFocus={this.props.autoFocus}
            style={this.props.styles.textInput}
            onChangeText={onChangeText ? text => {this._onChangeText(text); onChangeText(text)} : this._onChangeText}
            value={this.state.text}
            placeholder={this.props.placeholder}
            onFocus={onFocus ? () => {this._onFocus(); onFocus()} : this._onFocus}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
        {this._getCustomLocationButton()}
        {this._getListView()}
      </View>
    );
  },
});

module.exports = {GooglePlacesAutocomplete};
