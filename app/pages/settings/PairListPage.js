import React from 'react'
import { View, StyleSheet, Text, RefreshControl, Image, StatusBar, Dimensions, Platform } from 'react-native'
import {Container, List, ListItem, Button, Icon} from 'native-base'
import I18n from '../../lang/i18n'
import BtTransmitter from '../../device/BtTransmitter'
import {D, EsWallet} from 'esecubit-wallet-sdk'
import PreferenceUtil from "../../utils/PreferenceUtil"
import Dialog from "react-native-dialog"
import ToastUtil from "../../utils/ToastUtil"
import { ProgressDialog } from 'react-native-simple-dialogs'
import {NavigationActions, StackActions} from "react-navigation"
import {Color, Dimen, isIphoneX, CommonStyle } from "../../common/Styles"
const deviceW = Dimensions.get('window').width
const deviceH = Dimensions.get('window').height
const platform = Platform.OS

export default class PairListPage extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      deviceList: [],
      pairCode: '',
      connectDialogVisible: false,
      authenticateDialogVisible: false,
      refreshing: false,
      scanText: ''
    };
    this.transmitter = new BtTransmitter()
    this.wallet = new EsWallet()
    this.connectDeviceInfo = {}
    this.hasBackBtn = this.props.navigation.state.params.hasBackBtn
  }

  componentDidMount() {
    let _that = this
    this.props.navigation.addListener('didFocus', async () => {
      _that._listenTransmitter()
      await _that.setState({deviceList: []})
      _that._findDefaultDevice()
    })
  }

  _listenTransmitter() {
    let _that = this
    _that.transmitter.listenStatus(async (error, status, pairCode) => {
      console.log('connect status', error, status)
      if (error !== D.error.succeed) {
        ToastUtil.showLong('connectFailed')
        _that.setState({connectDialogVisible: false})
        return
      }
      if (status === BtTransmitter.connecting) {
        _that.setState({connectDialogVisible: true})
        return
      }
      if (status === BtTransmitter.authenticating && pairCode !== '') {
        console.log('authenticating', pairCode)
        _that.setState({connectDialogVisible: false})
        _that.setState({pairCode: pairCode, authenticateDialogVisible: true})
        return
      }
      if (status === BtTransmitter.authenticated) {
        _that.setState({authenticateDialogVisible: false})
        return
      }
      if (status === BtTransmitter.disconnected) {
        _that.setState({authenticateDialogVisible: false, connectDialogVisible: false})
        ToastUtil.showLong(I18n.t('disconnect'))
        return
      }
      if (status === BtTransmitter.connected) {
        console.log('device connected')
        _that.transmitter.stopScan()
        _that.setState({connectDialogVisible: false})
        console.log('connected device info', this.connectDeviceInfo)
        PreferenceUtil.setDefaultDevice(this.connectDeviceInfo)
        const resetAction = StackActions.reset({
          index: 0,
          actions: [NavigationActions.navigate({ routeName: 'Splash'})],
        });
        _that.props.navigation.dispatch(resetAction);
        return
      }
    })
  }

  _findDefaultDevice() {
    PreferenceUtil.getDefaultDevice()
      .then(value => {
        this._findDevice(value)
      })
      .catch(err => console.log(err))
  }

  _findDevice(deviceInfo) {
    let devices = new Set()
    let _that = this
    _that.transmitter.startScan((error, info) => {
      if (info.sn !== null && (info.sn.startsWith('ES12') || info.sn.startsWith('ES13'))) {
        devices.add(info)
      }
      _that.setState({
        deviceList: Array.from(devices)
      })
      //found default device, connect directly
      if (deviceInfo != null && info.sn === deviceInfo.sn) {
        this._connectDevice(deviceInfo)
      }
    })
  }

  _renderRowView(rowData) {
    return (
      <View style={[customStyle.itemContainer,{justifyContent: 'center', marginBottom: Dimen.SPACE}]}>
        <Text style={{textAlign: 'center' , justifyContent: 'center', color: Color.ACCENT , fontSize: Dimen.PRIMARY_TEXT}}>{rowData.sn}</Text>
      </View>
    )
  }

  _connectDevice(rowData) {
    console.log("connect device sn is", rowData)
    this.transmitter.connect(rowData)
    this.connectDeviceInfo = rowData
    this.setState({connectDialogVisible: true})
  }

  _onRefresh() {
    this.transmitter.stopScan()
    this.setState({
      refreshing: true,
      deviceList: []
    })
    this._findDefaultDevice()
    this.setState({
      refreshing: false
    })

  }

  render() {
    let bgHeight = (platform === "ios") && (!isIphoneX) ? deviceH*0.55 : deviceH*0.5
    let height = platform === 'ios' ? 64 : 56
    if (isIphoneX) {
      height = 88
    }
    return (
      <Container style={CommonStyle.layoutBottom}>
        <View style={{height:bgHeight}}>
          <Image
            source={require('../../imgs/bg_home.png')}
            resizeMode={'stretch'}
            style={{height:bgHeight}}
          >
            <View style={{height:height}}>
              <View style={{flex: 1, backgroundColor: 'transparent',flexDirection: 'row'}} translucent={false}>
                <StatusBar barStyle={platform === "ios" ? 'light-content' : 'default'} backgroundColor={Color.DARK_PRIMARY} hidden={false}/>
                <View style={{justifyContent: 'center', width: 48, height: height,marginTop:isIphoneX ? 20 : 0}}>
                  {
                    this.hasBackBtn
                      ?  <Button transparent onPress={() => { this.props.navigation.pop() }}>
                        <Icon name='ios-arrow-back' style={{color: Color.TEXT_ICONS}}/>
                      </Button>
                      : null
                  }
                </View>
              </View>
            </View>
            <View style={{marginLeft: deviceW * 0.37, marginTop: Dimen.MARGIN_VERTICAL}}>
              <Image source={require('../../imgs/bluetooth_bg.png')} style={{width: 100, height: 100}}/>
            </View>
            <View style={{ marginLeft: (I18n.locale === 'zh-Hans-CN') ? deviceW * 0.37 : deviceW * 0.14 }}>
              <Text style={{color: Color.TEXT_ICONS, fontSize: 25, marginTop: 30,backgroundColor: 'transparent'}}>{I18n.t('pairDevice')}</Text>
            </View>
          </Image>
        </View>

        <View style={customStyle.listView}>
          <List
            dataArray={this.state.deviceList}
            refreshControl={<RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={()=>this._onRefresh()} />}
            renderRow={(item) =>
              <ListItem onPress={() => this._connectDevice(item)}>
                {this._renderRowView(item)}
              </ListItem>
            }
          />
        </View>
        <ProgressDialog
          activityIndicatorColor= {Color.ACCENT}
          visible={this.state.connectDialogVisible}
          message={I18n.t('connecting')}
        />
        <Dialog.Container visible={this.state.authenticateDialogVisible}>
          <Dialog.Title>{I18n.t('pairCode')}</Dialog.Title>
          <Dialog.Description>{this.state.pairCode}</Dialog.Description>
        </Dialog.Container>
      </Container>
    )
  }

}

const customStyle = StyleSheet.create({
  listView: {
    flex: 1,
    marginTop: Dimen.MARGIN_VERTICAL,
  },
  itemContainer: {
    flex: 1,
    flexDirection: 'row',
    height: 20,
  },
  message: {
    marginLeft: Dimen.MARGIN_HORIZONTAL,
    marginTop: Dimen.SPACE
  }
})