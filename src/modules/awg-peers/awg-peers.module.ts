import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AwgPeersService } from './awg-peers.service';
import { QUERIES } from './queries';
import { AwgPeersRepository } from './repositories/awg-peers.repository';

@Module({
    imports: [CqrsModule],
    providers: [AwgPeersRepository, AwgPeersService, ...QUERIES],
})
export class AwgPeersModule {}
