import React, { PureComponent } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Button, Icon, Text } from 'native-base'
import { Color, Dimen } from '../common/Styles'
import I18n from '../lang/i18n'
import PropTypes from 'prop-types'

const deviceW = Dimensions.get('window').width

export default class AccountOperateBottomBar extends PureComponent {
  constructor() {
    super()
  }

  render() {
    const { leftOnPress, rightOnPress, visible } = this.props
    return (
      <View style={[styles.bottom, { display: visible ? 'flex' : 'none' }]}>
        <Button full light style={styles.sendButton} onPress={leftOnPress}>
          <Icon name="send" />
          <Text style={styles.btnSendText}>{I18n.t('send')}</Text>
        </Button>
        <Button
          full
          warning
          style={styles.receiveButton}
          onPress={rightOnPress}>
          <Icon name="download" />
          <Text style={styles.btnReceiveText}>{I18n.t('receive')}</Text>
        </Button>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  bottom: {
    marginTop: Dimen.SPACE,
    height: 55,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
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
    flex: 1,
    flexDirection: 'row',
    height: 55,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnSendText: {
    color: Color.PRIMARY_TEXT,
    fontSize: Dimen.PRIMARY_TEXT,
    marginLeft: -5
  },
  btnReceiveText: {
    color: Color.TEXT_ICONS,
    fontSize: Dimen.PRIMARY_TEXT,
    marginLeft: -5
  }
})

AccountOperateBottomBar.prototypes = {
  leftOnPress: PropTypes.func,
  rightOnPress: PropTypes.func,
  visible: PropTypes.bool
}

AccountOperateBottomBar.defaultProps = {
  visible: true
}
