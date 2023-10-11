import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {observer} from 'mobx-react-lite';
import React from 'react';
import {DepositModalNav} from './deposit-modal';
import {useBottomSheet} from '@gorhom/bottom-sheet';
import {useStyle} from '../../../../styles';
import {Box} from '../../../../components/box';
import {Column, Columns} from '../../../../components/column';
import {Gutter} from '../../../../components/gutter';
import {IconButton} from '../../../../components/icon-button';
import {ArrowLeftIcon} from '../../../../components/icon';
import {ChainImageFallback} from '../../../../components/image';
import {YAxis} from '../../../../components/axis';
import QRCode from 'react-native-qrcode-svg';
import {Text} from 'react-native';
import {useStore} from '../../../../stores';

//NOTE - navigation에서 기본으로 제공해주는 뒤로가기 버튼으로 할때는 뒤로 간뒤 넓어지는 애니메이션이 진행되는데
// 커스텀 버튼을 만들어서 goBack을 실행하면 뒤로 가면서 애니메이션이 실행되서 일단 이렇게 진행
export const QRScene = observer(() => {
  const bottom = useBottomSheet();
  const {chainStore} = useStore();
  const route = useRoute<RouteProp<DepositModalNav, 'QR'>>();
  const chainInfo = chainStore.getChain(route.params?.chainId);
  bottom.snapToPosition('40%');
  const style = useStyle();
  const nav = useNavigation();

  return (
    <Box style={style.flatten(['height-full'])}>
      <Columns alignY="center" sum={2}>
        <Gutter size={12} />
        <IconButton
          onPress={() => {
            nav.goBack();
          }}
          icon={color => <ArrowLeftIcon color={color} size={24} />}
        />
        <Column weight={1} />
        <ChainImageFallback
          style={{
            width: 32,
            height: 32,
          }}
          src={chainInfo.chainSymbolImageUrl}
          alt={chainInfo.chainName}
        />
        <Gutter size={8} />
        <Text style={style.flatten(['subtitle2', 'color-white'])}>
          {chainInfo.chainName}
        </Text>
        <Column weight={1} />
        <Box width={36} height={16} />
      </Columns>
      <YAxis alignX="center">
        <Box
          alignX="center"
          alignY="center"
          backgroundColor="white"
          borderRadius={20}
          padding={12}
          marginTop={20}>
          <QRCode
            value={route.params.bech32Address}
            size={176}
            backgroundColor="white"
            color="black"
            logo={require('../../../../public/assets/logo-256.png')}
          />
        </Box>

        <Gutter size={40} />
      </YAxis>
    </Box>
  );
});
