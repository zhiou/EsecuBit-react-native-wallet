import React from 'react'
import {View, StyleSheet, RefreshControl, Dimensions, Platform, TextInput, Clipboard, DeviceEventEmitter, ActionSheetIOS, Image, StatusBar, TouchableWithoutFeedback} from 'react-native'
import I18n from '../../lang/i18n'
import {Button, Container, Left, Right, Icon, List, ListItem, Content, CheckBox, Body, CardItem, Text} from 'native-base'
import PopupDialog from 'react-native-popup-dialog'
import QrCode from 'react-native-qrcode'
import BigInteger from 'bigi'
import {isIphoneX, CommonStyle, Dimen, Color } from '../../common/Styles'
import EsAccountHelper from "../../EsAccountHelper"
import {EsWallet, D} from 'esecubit-wallet-sdk'
import CoinUtil from '../../utils/CoinUtil'
import ToastUtil from '../../utils/ToastUtil'
import Menu, {MenuItem} from "react-native-material-menu"
import Dialog from "react-native-dialog"
import BtTransmitter from '../../device/BtTransmitter'
import {TOAST_SHORT_DURATION} from "../../common/Constants"
import StringUtil from '../../utils/StringUtil'

const deviceW = Dimensions.get('window').width
const platform = Platform.OS;

const BTC_TRANSACTION_DETAIL_DIALOG_HEIGHT = 434
const ETH_TRANSACTION_DETAIL_DIALOG_HEIGHT = 520

export default class AccountDetailPage extends React.Component {

  constructor(props) {
    super(props)
    this.wallet = new EsWallet()
    this.account = EsAccountHelper.getInstance().getAccount()
    const {params} = props.navigation.state
    this.coinType = params.coinType
    this.minimumCryptoCurrencyUnit = D.isBtc(this.coinType) ? D.unit.btc.satoshi : D.unit.eth.Wei
    this.cryptoCurrencyUnit = D.isBtc(this.coinType) ? params.btcUnit : params.ethUnit
    this.legalCurrencyUnit = params.legalCurrencyUnit
    this.cellHeight = platform === "ios" ? 95 : 110
    this.memoHeight = platform === "ios" ? 36 : 48
    //transmitter
    this.transmitter = new BtTransmitter()

    this.state = {
      isShowBottom: true,
      data: [],//存储列表使用的数据
      refreshing: false,//当前的刷新状态
      address: '',
      accountBalance: '',
      coinType: D.isBtc(EsAccountHelper.getInstance().getAccount()['coinType']) ? D.supportedCoinTypes()[0] : D.supportedCoinTypes()[1],
      isShowDetail: false,
      dMemo: '',
      bottomDisplay: 'flex',
      renameDialogVisible: false,
      accountName: this.account.label,
      showQrCode: false,
      selectStoreAddress: false,
      containerBgColor: Color.CONTAINER_BG,
      legalCurrencyBalance: ''
    }
    this._setClipboardContent.bind(this)
  }

  componentDidMount() {
    let _that = this
    CoinUtil.getInstance().minimumCryptoCurrencyToDefautCurrency(_that.account['coinType'], _that.account['balance'])
      .then(value => {
        _that.setState({accountBalance: value})
        _that._getLegalCurrencyBalance()
      })
    //get tx list
    _that._getTxInfos()
    let minimumUnit = D.isBtc(this.coinType) ? D.unit.btc.satoshi : D.unit.eth.Wei
    //listenTxInfo
    _that.wallet.listenTxInfo(async (errCode, txInfo) => {
      console.log("listenTxInfo _getTxInfos")
      await _that._getTxInfos()
      let balance = _that.wallet.convertValue(_that.coinType, _that.account.balance, minimumUnit, _that.cryptoCurrencyUnit)
      _that.setState({accountBalance: balance})
      _that._getLegalCurrencyBalance()
    })
    this._initListener()
    this._getLegalCurrencyBalance()
  }

  _getLegalCurrencyBalance() {
    let legalCurrencyBalance = this.wallet.convertValue(this.coinType, this.account.balance, this.minimumCryptoCurrencyUnit, this.legalCurrencyUnit)
    legalCurrencyBalance = Number(legalCurrencyBalance).toFixed(2).toString()
    this.setState({legalCurrencyBalance: legalCurrencyBalance})
  }

  _initListener() {
    DeviceEventEmitter.addListener('balance', () => {
      let value = this.wallet.convertValue(this.coinType, this.account.balance, this.minimumCryptoCurrencyUnit, this.cryptoCurrencyUnit)
      this.setState({accountBalance: value})
      this._getLegalCurrencyBalance()
    })
  }

  async _gotoSendPage() {
    let deviceState = await this.transmitter.getState()
    if (deviceState === BtTransmitter.disconnected) {
      ToastUtil.showShort(I18n.t('pleaseConnectDevice'))
      return
    }
    let param = {
      coinType: this.coinType,
      cryptoCurrencyUnit: this.cryptoCurrencyUnit,
      legalCurrencyUnit: this.legalCurrencyUnit
    }
    if (D.isBtc(this.coinType)) {
      this.props.navigation.navigate('BTCSend', param)
    } else {
      this.props.navigation.navigate('ETHSend', param)
    }
  }

  async _showAddressDialog() {
    let deviceState = await this.transmitter.getState()
    if (deviceState === BtTransmitter.disconnected) {
      ToastUtil.showShort(I18n.t('pleaseConnectDevice'))
      return
    }
    this._getAddress(this.state.selectStoreAddress)
    this.popupDialog.show()
  }

  async _getAddress(shouldStoreAddress) {
    try {
      let address = await this.account.getAddress(shouldStoreAddress)
      this.setState({address: address})
    } catch (error) {
      console.warn('getAddress', error)
      ToastUtil.showLong(I18n.t('getAddressError'))
    }
  }

  _onRefresh() {
    this.setState({
      refreshing: true,
    })
    this.account.sync()
      .then(async () => {
        console.log("sync _getTxInfos")
        await this._getTxInfos()
        this.setState({refreshing: false})
      })
      .catch(error => {
        console.warn('_onRefresh', error)
        this.setState({refreshing: false})
        ToastUtil.showErrorMsgLong(error)
      })
  }

  /**
   * Render a row
   * @param {object} rowData
   */
  _renderRowView(rowData) {

    let title = ''
    let date = StringUtil.formatTimeStamp(rowData.time)
    let price = "0"
    let temp = ''
    let symbol = ''
    let unit = ''
    let priceColor = Color.ACCENT
    let isToSelf = false
    let rowHeight = 0
    let memo = rowData.comment
    let confirmStr = ''
    let confirmColor = Color.ACCENT

    rowData.showAddresses.forEach(function (item, index, array) {
      let addr = ''
      if (item === 'self' || item === 'Self' || item === 'SELF') {
        addr = item
        isToSelf = true
      } else {
        addr = item.substr(0, 16) + '*****'
      }
      if (index !== rowData.showAddresses.length - 1) {
        temp = temp + addr + ','
      } else {
        temp = temp + addr
      }
    })

    if (rowData.direction === D.tx.direction.in) {
      title = 'From:' + temp
      symbol = '+'
      priceColor = Color.INCREASE
    } else {
      title = 'To:' + temp
      symbol = '-'
      priceColor = Color.REDUCED
    }

    if (D.isBtc(rowData.coinType)) {
      unit = this.cryptoCurrencyUnit
      price = this._getBTCPrice(rowData, isToSelf)
    } else {
      unit = this.cryptoCurrencyUnit
      price = this._getETHPrice(rowData, isToSelf)
    }

    if (price < 0) {
      price = -price
    }

    if (rowData.confirmations === -1) {
      confirmStr = I18n.t('pending')
    } else if (rowData.confirmations === -2) {
      confirmStr = I18n.t('invalid')
    } else if (rowData.confirmations >= 6) {
      confirmStr = ''
    } else if (0 <= rowData.confirmations && rowData.confirmations < 6) {
      confirmStr = I18n.t('confirming')
    }

    if (memo !== undefined && memo !== null && memo !== '') {
      title = memo
    }

    if (platform === "ios") {
      rowHeight = 85
    } else {
      rowHeight = 100
    }

    return (
      <CardItem button style={{backgroundColor: Color.CONTAINER_BG}} onPress={() => {this._showTransactionDetailDialog(rowData)}}>
        <View style={{
          height: rowHeight,
          width: deviceW - 2 * Dimen.MARGIN_HORIZONTAL,
          backgroundColor: Color.TEXT_ICONS,
          borderRadius: 10,
          elevation: 3
        }}>
          <View style={customStyle.itemContainer}>
            <View style={{width: (deviceW - 2 * Dimen.MARGIN_HORIZONTAL) * 3 / 5 - 10, marginTop: 15, marginLeft: 10}}>
              <Text style={customStyle.leftText} numberOfLines={2} ellipsizeMode='tail'>{title}</Text>
            </View>
            <View style={{
              width: (deviceW - 2 * Dimen.MARGIN_HORIZONTAL) * 2 / 5 - 10,
              alignItems: 'flex-end',
              marginTop: 15,
              marginRight: 10
            }}>
              <Text
                style={[customStyle.rightText, {color: priceColor}]}>{symbol + ' ' + StringUtil.formatCryptoCurrency(price)}</Text>
            </View>
          </View>
          <View style={customStyle.itemContainer}>
            <View style={{
              width: (deviceW - 2 * Dimen.MARGIN_HORIZONTAL) * 3 / 5 - 10,
              justifyContent: 'flex-end',
              marginBottom: 15,
              marginLeft: 10
            }}>
              <Text style={customStyle.leftText}>{date}</Text>
            </View>
            <View style={{
              width: (deviceW - 2 * Dimen.MARGIN_HORIZONTAL) * 2 / 5 - 10,
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              marginBottom: 15,
              marginRight: 10
            }}>
              <Text style={{fontSize: Dimen.SECONDARY_TEXT, color: confirmColor}}>{confirmStr}</Text>
            </View>
          </View>
        </View>
      </CardItem>
    )
  }

  _getBTCPrice(rowData, isToSelf) {
    let price = "0"
    let value = StringUtil.removeNegativeSymbol(rowData.value)
    if (rowData.direction === D.tx.direction.in) {
      price = this.wallet.convertValue(this.coinType, value, D.unit.btc.satoshi, this.cryptoCurrencyUnit)
    } else {
      price = this.wallet.convertValue(this.coinType, value, D.unit.btc.satoshi, this.cryptoCurrencyUnit)
      if (isToSelf) {
        price = this.wallet.convertValue(this.coinType, rowData.fee, D.unit.btc.satoshi, this.cryptoCurrencyUnit)
      }
    }
    return price
  }

  _getETHPrice(rowData, isToSelf) {
    let price = "0"
    let value = StringUtil.removeNegativeSymbol(rowData.value)
    if (rowData.direction === D.tx.direction.in) {
      price = this.wallet.convertValue(this.coinType, rowData.value, D.unit.eth.Wei, this.cryptoCurrencyUnit)
    } else {
      if (!isToSelf) {
        price = new BigInteger(rowData.fee).add(new BigInteger(value)).toString(10)
        price = this.wallet.convertValue(this.coinType, price, D.unit.eth.Wei, this.cryptoCurrencyUnit)
      } else {
        price = this.wallet.convertValue(this.coinType, rowData.fee, D.unit.eth.Wei, this.cryptoCurrencyUnit)
      }
    }
    return price
  }

  async _showTransactionDetailDialog(rowData) {
    console.log("rowData===", rowData)
    this.dTxInfo = rowData
    let price = "0"
    let unit = this.cryptoCurrencyUnit
    let isToSelf = false
    let total = "0"
    let addr = ''
    this.rowData = rowData

    rowData.showAddresses.forEach(function (item, index, array) {
      // debugger
      if (item === 'self' || item === 'Self' || item === 'SELF') {
        isToSelf = true
        addr = item
      } else {
        if (index !== rowData.showAddresses.length - 1) {
          addr = addr + item + ','
        } else {
          addr = addr + item
        }
      }
    })

    this.dAddr = addr

    if (D.isBtc(rowData.coinType)) {
      if (rowData.direction === D.tx.direction.in) {
        price = "0"
      } else {
        let value = rowData.value
        if (value.startsWith('-')) {
          value = value.slice(1, value.length)
        }
        price = this.wallet.convertValue(this.coinType, value, D.unit.btc.satoshi, this.cryptoCurrencyUnit)
        // unit = this.cryptoCurrencyUnit
        if (isToSelf) {
          price = this.wallet.convertValue(this.coinType, rowData.fee, D.unit.btc.satoshi, this.cryptoCurrencyUnit)
        }
      }
      total = price
    } else {
      if (rowData.direction === D.tx.direction.in) {
        price = "0"
      } else {
        if (!isToSelf) {
          let value = rowData.value
          if (value.startsWith('-')) {
            value = value.slice(1, value.length)
          }
          price = new BigInteger(rowData.fee).add(new BigInteger(value)).toString(10)
          // console.log('adsadasd', price,value)
          price = this.wallet.convertValue(this.coinType, price, D.unit.eth.Wei, this.cryptoCurrencyUnit)
        } else {
          price = this.wallet.convertValue(this.coinType, rowData.fee, D.unit.eth.Wei, this.cryptoCurrencyUnit)
        }
      }
      total = price
    }

    if (rowData.direction === D.tx.direction.in) {
      this.dTitle = I18n.t('income')
      this.dAmountColor = Color.INCREASE
    } else {
      this.dTitle = I18n.t('expenditure')
      this.dAmountColor = Color.REDUCED
    }

    if (D.isEth(rowData.coinType)) {
      this.dAmount = this._getETHPrice(rowData, isToSelf) + ' ' + unit
    } else {
      this.dAmount = this._getBTCPrice(rowData, isToSelf) + ' '+ unit
    }

    this.dDate = StringUtil.formatTimeStamp(rowData.time)

    if (rowData.confirmations >= 6) {
      this.dConfirmStr = I18n.t('complete')
    } else {
      this.dConfirmStr = I18n.t('unfinished')
    }

    if (total < 0) {
      total = -total
    }
    this.dTotal = total + ' ' + unit
    this.dConfirmNum = rowData.confirmations
    this.dTxId = rowData.txId
    this.resendableText = rowData.canResend ? I18n.t('yes') : I18n.t('no')
    this.canResend = rowData.canResend
    if (rowData.shouldResend) {
      this.resendableText = I18n.t('adviceToResend')
    }
    if (rowData.comment !== undefined && rowData.comment !== null) {
      this.setState({dMemo: rowData.comment})
    } else {
      this.setState({dMemo: ''})
    }

    if (rowData.data !== undefined && rowData.data !== null) {
      this.dSmartContract = rowData.data
    } else {
      this.dSmartContract = 'none'
    }

    this.setState({isShowDetail: true})
    this.transactionDetailDialog.show()
  }

  _getTxInfos() {
    EsAccountHelper.getInstance().getAccount().getTxInfos()
      .then(txInfos => {
        this.setState({data: txInfos.txInfos})
        // console.log("_getTxInfos",txInfos)
      })
      .catch(error => ToastUtil.showErrorMsgLong(error))
  }

  _setClipboardContent(addr) {
    try {
      Clipboard.setString(addr)
      ToastUtil.show(I18n.t('copySuccess', TOAST_SHORT_DURATION))
    } catch (error) {
      ToastUtil.showLong(I18n.t('copyFailed'))
    }
  }

  _showRenameAccountDialog() {
    this.moreMenu.hide()
    this.setState({renameDialogVisible: true})
  }

  _showRenameAccountDialogIOS() {
    let _that = this
    ActionSheetIOS.showActionSheetWithOptions({
      options: [
        I18n.t('renameAccount'),
        I18n.t('cancel')
      ],
      cancelButtonIndex: 1,
      destructiveButtonIndex: 0
    }, function (index) {
      if (index === 0) {
        _that.setState({renameDialogVisible: true})
      }
    })
  }

  _renameAccount() {
    this.account.rename(this.renameAccountname)
      .then(() => this.setState({accountName: this.renameAccountname}))
      .then(() => {
        console.log('rename emiter')
        DeviceEventEmitter.emit('rename')
      })
      .catch(error => ToastUtil.showErrorMsgLong(error))
  }

  async _handleStoreAddress() {
    await this.setState({selectStoreAddress: !this.state.selectStoreAddress})
    if (this.state.selectStoreAddress === true) {
      this._getAddress(this.state.selectStoreAddress)
    }
  }

  _handleTransactionDetailDismiss() {
    //lose focus
    this.memoTextInput.blur()
    this.setState({
      bottomDisplay: 'flex'
    })
    if (this.state.dMemo !== '') {
      this.dTxInfo.comment = this.state.dMemo;
      this.account.updateTxComment(this.dTxInfo)
        .then(() => {
          console.log("updateTxComment success")
          this._getTxInfos()
        })
        .catch(error => ToastUtil.showLong('UpdateTxComment Error', error))
    }
  }

  render() {
    // const params  = this.props.navigation.state.params
    let height = platform === 'ios' ? 64 : 56
    if (isIphoneX) {
      height = 88
    }
    return (
      <Container style={[CommonStyle.layoutBottom, {backgroundColor: Color.CONTAINER_BG}]}>
        <View style={{height: 205}}>
          <Image
            style={{height: 205}}
            source={require('../../imgs/bg_detail.png')}
          >
            <View style={{height: height}}>
              <View style={{flex: 1, backgroundColor: 'transparent', flexDirection: 'row'}} translucent={false}>
                <StatusBar barStyle={platform === "ios" ? 'light-content' : 'default'} backgroundColor={Color.DARK_PRIMARY} hidden={false}/>
                <View style={{justifyContent: 'center', width: 48, height: height, marginTop: isIphoneX ? 20 : 0}}>
                  <Button transparent onPress={() => {
                    this.props.navigation.pop()
                  }}>
                    <Icon name='ios-arrow-back' style={{color: Color.TEXT_ICONS}}/>
                  </Button>
                </View>
                <View style={{width: deviceW - 48 - 48 + 16, justifyContent: 'center', alignItems: 'center'}}>
                </View>
                <View style={{justifyContent: 'center', width: 48, height: height, marginTop: isIphoneX ? 20 : 0}}>
                  {
                    platform === "ios" ?
                      <Button transparent onPress={() => {
                        this._showRenameAccountDialogIOS()
                      }}
                      >
                        <Image source={require('../../imgs/ic_more.png')} style={{width: 20}}/>
                      </Button>
                      :
                      <Menu
                        ref={(refs) => this.moreMenu = refs}
                        button={<Button transparent onPress={() => this.moreMenu.show()}>
                          <Image source={require('../../imgs/ic_more.png')}/>
                        </Button>}>
                        <MenuItem onPress={this._showRenameAccountDialog.bind(this)}>
                          {I18n.t('renameAccount')}</MenuItem>
                      </Menu>
                  }
                </View>
              </View>
            </View>
            <View style={{flexDirection: 'column'}}>
              <Text style={{marginTop: 30, paddingHorizontal: Dimen.MARGIN_HORIZONTAL, color: Color.ACCENT, backgroundColor: 'transparent', fontSize: Dimen.PRIMARY_TEXT}} numberOfLines={1} ellipsizeMode='middle'>
                {this.account['label']}
              </Text>
              <View style={{width: this.deviceW, flexDirection: 'row', backgroundColor: 'transparent'}}>
                <Text style={{color: Color.TEXT_ICONS, fontSize: 27, marginTop: 5, marginLeft: Dimen.MARGIN_HORIZONTAL, backgroundColor: 'transparent'}}>{this.state.accountBalance}</Text>
                <Text style={{color: Color.ACCENT, alignSelf: 'auto', fontSize: 13, marginTop: 5, marginLeft: Dimen.SPACE}}>{this.cryptoCurrencyUnit}</Text>
              </View>
              <Text style={{marginTop: 5, paddingHorizontal: Dimen.MARGIN_HORIZONTAL, color: Color.ACCENT, backgroundColor: 'transparent', fontSize: Dimen.SECONDARY_TEXT}} numberOfLines={1} ellipsizeMode='middle'>
                {StringUtil.formatLegalCurrency(Number(this.state.legalCurrencyBalance).toFixed(2)) +' '+ this.legalCurrencyUnit}
              </Text>
            </View>
          </Image>
        </View>
        <Dialog.Container visible={this.state.renameDialogVisible}>
          <Dialog.Title>{I18n.t('renameAccount')}</Dialog.Title>
          <Dialog.Description>{I18n.t('renameAccountHint')}</Dialog.Description>
          <Dialog.Input selectionColor={Color.ACCENT} underlineColorAndroid={Color.ACCENT} onChangeText={text => this.renameAccountname = text}/>
          <Dialog.Button style={{color: Color.ACCENT}} label={I18n.t('cancel')} onPress={() => this.setState({renameDialogVisible: false})}/>
          <Dialog.Button style={{color: Color.ACCENT}} label={I18n.t('confirm')} onPress={() => {
            this.setState({renameDialogVisible: false});
            this._renameAccount()
          }}/>
        </Dialog.Container>
        <View style={{height: 40, width: deviceW, backgroundColor: Color.CONTAINER_BG}}>
          <Text
            style={customStyle.listTitleText}>{I18n.t('transactionRecord') + '( ' + I18n.t('value') + ': ' + this.cryptoCurrencyUnit + ' )'}</Text>
        </View>
        <View style={{height: 1}}/>
        <View style={customStyle.listView}>
          <List
            refreshControl={<RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={() => this._onRefresh()}/>} dataArray={this.state.data}
            renderRow={(item) => <ListItem
              style={{height: this.cellHeight, backgroundColor: Color.CONTAINER_BG, marginLeft: 0, paddingLeft: 0}}
              itemDivider={true}>{this._renderRowView(item)}</ListItem>}
            onEndReachedThreshold={10}
          />
        </View>
        <PopupDialog
          ref={(popupDialog) => {
            this.popupDialog = popupDialog;
          }}
          width={0.8}
          height={D.isBtc(this.coinType) ? 455 : 415}
          containerStyle={{backgroundColor: '#E0E0E0'}}
          onDismissed={() => {
            this.setState({
              bottomDisplay: 'flex',
            })
          }}
          onShown={() => {
            this.setState({
              bottomDisplay: 'none',
            })
          }}>
          <View style={customStyle.qrCodeWrapper}>
            <Text style={CommonStyle.secondaryText}>{I18n.t('showAddressTip')}</Text>
            <TouchableWithoutFeedback onLongPress={() => this._setClipboardContent(this.state.address.address)}>
              <View style={customStyle.qrCodeView}>
                <QrCode
                  value={this.state.address.qrAddress}
                  size={240}
                  bgColor="black"
                  fgColor='white'
                />
              </View>
            </TouchableWithoutFeedback>

            {
              D.isBtc(this.coinType)
                ? <View style={customStyle.checkboxWrpper}>
                  <Left><CheckBox style={{justifyContent: 'center'}} checked={this.state.selectStoreAddress} onPress={() => this._handleStoreAddress()}/></Left>
                  <Body style={{flex: 3}}><Text style={CommonStyle.privateText}>{I18n.t('saveAddress')}</Text></Body>
                  <Right/>
                </View>
                : null
            }
            <Text style={[CommonStyle.privateText, customStyle.addressText]}>{this.state.address.address}</Text>
            <Text style={customStyle.remindText}>{I18n.t('copyRemind')}</Text>
          </View>
        </PopupDialog>

        <PopupDialog
          ref={(popupDialog) => {
            this.transactionDetailDialog = popupDialog
          }}
          width={0.9}
          height={D.isBtc(this.coinType) ? BTC_TRANSACTION_DETAIL_DIALOG_HEIGHT : ETH_TRANSACTION_DETAIL_DIALOG_HEIGHT}
          onDismissed={() => this._handleTransactionDetailDismiss()}
          onShown={() => this.setState({bottomDisplay: 'none'})}
        >
          <Content>
            <View style={{flex: 1}}>
              <View style={{
                width: deviceW * 0.9,
                height: 30,
                marginTop: 20,
                flexDirection: 'row',
                justifyContent: 'space-between'
              }}>
                <View style={{width: 40, height: 30}}/>
                <View>
                  <Text style={{fontSize: 18}}>{this.dTitle}</Text>
                </View>
                <View style={{marginTop: -10, marginRight: 10}}>
                  <Icon name='close' type='MaterialCommunityIcons' onPress={() => {
                    this.transactionDetailDialog.dismiss()
                  }}/>
                </View>
              </View>
              <View style={{width: deviceW * 0.9, height: 30, marginTop: 10, alignItems: 'center'}}>
                <View>
                  <Text style={{fontSize: 22, color: this.dAmountColor}}>{this.dAmount}</Text>
                </View>
              </View>
              <View style={[customStyle.detailLine, {marginTop: 15}]}/>
              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{this.dConfirmStr}</Text>
                <Text style={customStyle.detailCellRightText}>{this.dDate}</Text>
              </View>
              <View style={customStyle.detailLine}/>
              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('through')}</Text>
                <Text style={[customStyle.detailCellRightText, {width: deviceW * 0.7 * 0.8, marginLeft: 10}]} ellipsizeMode='middle' numberOfLines={1}>{this.dAddr}</Text>
              </View>
              <View style={customStyle.detailLine}/>

              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('memo')}</Text>
                {/*<Text style={[customStyle.detailCellRightText,{width: deviceW*0.9*0.7, marginLeft: 10}]} ellipsizeMode='middle' numberOfLines={1}>123</Text>*/}
                <TextInput
                  selectionColor='#EBBD36'
                  placeholder={I18n.t('addMemo')}
                  style={[customStyle.detailCellInput, {height: this.memoHeight}]}
                  returnKeyType='done'
                  underlineColorAndroid='transparent'
                  onChangeText={(text) => {
                    this.setState({dMemo: text})
                  }}
                  value={this.state.dMemo}
                  ref={(textInput) => {
                    this.memoTextInput = textInput
                  }}
                />
              </View>
              <View style={customStyle.detailLine}/>

              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('totalCost')}</Text>
                <Text style={customStyle.detailCellRightText}>{this.dTotal}</Text>
              </View>
              <View style={customStyle.detailLine}/>
              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('confirmNum')}</Text>
                <Text style={customStyle.detailCellRightText}>{this.dConfirmNum}</Text>
              </View>
              <View style={customStyle.detailLine}/>
              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('tradingID')}</Text>
                <Text style={[customStyle.detailCellRightText, {width: deviceW * 0.9 * 0.7, marginLeft: 10}]} ellipsizeMode='middle' numberOfLines={1}>{this.dTxId}</Text>
              </View>
              <View style={customStyle.detailLine}/>
              {
                D.isBtc(this.coinType) ? null
                  : <View style={{
                    width: deviceW * 0.9,
                    height: 75,
                    flexDirection: 'row',
                    paddingHorizontal: 10,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <View>
                      <Text style={customStyle.detailCellLeftText}>Data</Text>
                    </View>
                    <View style={{width: deviceW * 0.9 * 0.7, height: 60}}>
                      <Content>
                        <Text style={{fontSize: Dimen.PRIMARY_TEXT, textAlign: 'left'}} numberOfLines={0}>{this.dSmartContract}</Text>
                      </Content>
                    </View>
                  </View>
              }
              {
                D.isBtc(this.coinType) ? null
                  : <View style={customStyle.detailLine}/>
              }
              <View style={customStyle.detailCell}>
                <Text style={customStyle.detailCellLeftText}>{I18n.t('canResend')}</Text>
                <Text style={customStyle.detailCellRightText}>{this.resendableText}</Text>
              </View>
            </View>
            {
              this.canResend
                ? <View style={customStyle.resendBtnWrapper}>
                  <Button style={{backgroundColor: '#EBBD36', flex: 1, justifyContent: 'center'}} onPress={() => {
                    console.log('as', this.rowData)
                    this.transactionDetailDialog.dismiss()
                    if (D.isBtc(this.coinType)) {
                      this.props.navigation.navigate('BTCSend', {
                        txInfo: this.rowData,
                        coinType: this.coinType,
                        cryptoCurrencyUnit: this.cryptoCurrencyUnit,
                        legalCurrencyUnit: this.legalCurrencyUni
                      })
                    } else {
                      this.props.navigation.navigate('ETHSend', {
                        txInfo: this.rowData,
                        coinType: this.coinType,
                        cryptoCurrencyUnit: this.cryptoCurrencyUnit,
                        legalCurrencyUnit: this.legalCurrencyUni
                      })
                    }
                  }
                  }>
                    <Text style={{textAlign: 'center'}}>{I18n.t('resend')}</Text>
                  </Button>
                </View>
                : null
            }
          </Content>
        </PopupDialog>
        <View
          style={[customStyle.bottom, {display: this.state.bottomDisplay}]}>
          <Button full light style={customStyle.sendButton} onPress={() => {
            this._gotoSendPage()
          }}>
            <Icon name='send'/>
            <Text style={customStyle.btnSendText}>{I18n.t('send')}</Text>
          </Button>
          <Button full warning style={customStyle.receiveButton} onPress={() => {
            this._showAddressDialog()
          }}>
            <Icon name='download'/>
            <Text style={customStyle.btnReceiveText}>{I18n.t('receive')}</Text>
          </Button>
        </View>
      </Container>
    )
  }
}

const customStyle = StyleSheet.create({

  sectionHeader: {
    paddingHorizontal: Dimen.MARGIN_HORIZONTAL,
    flex: 0,
    flexDirection: 'row'
  },
  sectionHeaderText: {
    fontSize: Dimen.SECONDARY_TEXT,
    color: Color.SECONDARY_TEXT,
    flex: 1,
    textAlignVertical: 'center'
  },
  sectionHeaderDropdown: {
    flex: 1
  },
  listView: {
    flex: 1,
    // marginTop: 0,
  },
  itemContainer: {
    flex: 1,
    flexDirection: 'row',
    // height:50,
  },
  itemLeft: {
    flex: 1,
  },
  leftText: {
    color: Color.PRIMARY_TEXT,
    fontSize: Dimen.SECONDARY_TEXT,
  },
  rightText: {
    fontSize: Dimen.SECONDARY_TEXT,
  },
  divider: {
    height: 1,
    backgroundColor: Color.DIVIDER
  },
  bottom: {
    // paddingHorizontal: DIMEN_MARGIN_HORIZONTAL,
    marginTop: Dimen.SPACE,
    height: 55,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    width: deviceW * 0.5,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Color.TEXT_ICONS
  },
  receiveButton: {
    // marginLeft: DIMEN_SPACE,
    flex: 1,
    flexDirection: 'row',
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeWrapper: {
    flex: 1,
    margin: Dimen.MARGIN_HORIZONTAL
  },
  qrCodeView: {
    marginTop: Dimen.SPACE,
    alignItems: 'center',
  },
  qrCodeHintText: {
    textAlign: 'center',

  },
  addressText: {
    marginHorizontal: Dimen.MARGIN_HORIZONTAL,
    marginTop: Dimen.SPACE,
    // marginBottom: DIMEN_SPACE,
    height: 45
  },
  remindText: {
    marginHorizontal: Dimen.MARGIN_HORIZONTAL,
    marginTop: Dimen.SPACE,
    height: 40,
    fontSize: Dimen.SECONDARY_TEXT,
    color: Color.SECONDARY_TEXT,
    textAlignVertical: 'center',
    textAlign: 'center'
  },
  btnText: {
    flex: 1,
    textAlign: 'center',
    color: Color.TEXT_ICONS,
    fontSize: Dimen.PRIMARY_TEXT
  },
  btnSendText: {
    // flex: 1,
    // textAlign: 'center',
    color: Color.PRIMARY_TEXT,
    fontSize: Dimen.PRIMARY_TEXT,
    marginLeft: -5,
  },
  btnReceiveText: {
    // flex: 1,
    // textAlign: 'center',
    color: Color.TEXT_ICONS,
    fontSize: Dimen.PRIMARY_TEXT,
    marginLeft: -5,
  },
  copyBtn: {
    width: deviceW * 0.8 - 2 * Dimen.MARGIN_HORIZONTAL,
    height: 40,
    alignItems: 'center',
    marginBottom: Dimen.MARGIN_VERTICAL
  },
  copyBtnText: {
    flex: 1,
    textAlign: 'center',
    color: Color.TEXT_ICONS,
    fontSize: 18
  },
  listTitleText: {
    marginLeft: 25,
    marginTop: 15,
    color: Color.SECONDARY_TEXT,
    fontSize: Dimen.SECONDARY_TEXT
  },

  //详情页弹框style
  detailCell: {
    width: deviceW * 0.9,
    height: 45,
    flexDirection: 'row',
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLine: {
    width: deviceW * 0.9,
    height: 1,
    backgroundColor: Color.DIVIDER
  },
  detailCellLeftText: {
    fontSize: Dimen.PRIMARY_TEXT,
    color: Color.SECONDARY_TEXT,
  },
  detailCellRightText: {
    fontSize: Dimen.PRIMARY_TEXT,
    textAlign: 'right',
    color: Color.PRIMARY_TEXT
  },
  detailCellInput: {
    fontSize: Dimen.PRIMARY_TEXT,
    textAlign: 'right',
    width: deviceW * 0.9 * 0.7,
    // height:48,
    marginLeft: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 0,
    paddingLeft: 5,
    paddingRight: 5,
  },
  checkboxWrpper: {
    marginLeft: Dimen.MARGIN_HORIZONTAL,
    marginTop: Dimen.SPACE,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  resendBtnWrapper: {
    height: 50,
    flexDirection: 'row',
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Dimen.SPACE
  }
})
