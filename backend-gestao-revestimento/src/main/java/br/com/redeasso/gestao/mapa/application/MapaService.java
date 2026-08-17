package br.com.redeasso.gestao.mapa.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest;
import br.com.redeasso.gestao.mapa.api.dto.AtualizarMapaRequest;
import br.com.redeasso.gestao.mapa.api.dto.CriarMapaRequest;
import br.com.redeasso.gestao.mapa.api.dto.MapaCelulaInput;
import br.com.redeasso.gestao.mapa.api.dto.MapaCelulaResponse;
import br.com.redeasso.gestao.mapa.api.dto.MapaLabelsRequest;
import br.com.redeasso.gestao.mapa.api.dto.MapaLabelsResponse;
import br.com.redeasso.gestao.mapa.api.dto.MapaResponse;
import br.com.redeasso.gestao.mapa.domain.Mapa;
import br.com.redeasso.gestao.mapa.domain.MapaCelula;
import br.com.redeasso.gestao.mapa.infrastructure.MapaCelulaRepository;
import br.com.redeasso.gestao.mapa.infrastructure.MapaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MapaService {

    private static final int MAX_LINHAS = 26;
    private static final int MAX_COLUNAS = 50;

    private final MapaRepository mapaRepository;
    private final MapaCelulaRepository celulaRepository;
    private final PisoRepository pisoRepository;
    private final AtividadeService atividadeService;

    public MapaService(
            MapaRepository mapaRepository,
            MapaCelulaRepository celulaRepository,
            PisoRepository pisoRepository,
            AtividadeService atividadeService) {
        this.mapaRepository = mapaRepository;
        this.celulaRepository = celulaRepository;
        this.pisoRepository = pisoRepository;
        this.atividadeService = atividadeService;
    }

    @Transactional(readOnly = true)
    public List<MapaResponse> listar() {
        var mapas = mapaRepository.findAllByOrderByIdAsc();
        if (mapas.isEmpty()) {
            return List.of();
        }

        var ids = mapas.stream().map(Mapa::getId).toList();
        var celulasPorMapa = celulaRepository
                .findAllByMapaIdInOrderByMapaIdAscPosicaoAscOrdemAsc(ids)
                .stream()
                .collect(Collectors.groupingBy(
                        celula -> celula.getMapa().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        return mapas.stream()
                .map(mapa -> responder(mapa, celulasPorMapa.getOrDefault(mapa.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public MapaResponse buscar(Long id) {
        var mapa = buscarMapa(id);
        return responder(mapa, celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(id));
    }

    @Transactional
    public MapaResponse criar(CriarMapaRequest request) {
        if (request == null
                || request.nome() == null
                || request.nome().isEmpty()
                || request.linhas() == null
                || request.colunas() == null
                || request.linhas() < 1
                || request.linhas() > MAX_LINHAS
                || request.colunas() < 1
                || request.colunas() > MAX_COLUNAS) {
            throw MapaException.entradaInvalida("Informe nome, linhas (1-26) e colunas (1-50)");
        }
        validarTamanho(request.nome(), "Nome do mapa");

        var labels = request.labels();
        var mapa = new Mapa(
                request.nome(),
                request.linhas(),
                request.colunas(),
                labelNovo(labels == null ? null : labels.top()),
                labelNovo(labels == null ? null : labels.bottom()),
                labelNovo(labels == null ? null : labels.left()),
                labelNovo(labels == null ? null : labels.right()));
        mapaRepository.saveAndFlush(mapa);
        atividadeService.registrar("mapa", "Mapa \"" + mapa.getNome() + "\" criado", null);
        return responder(mapa, List.of());
    }

    @Transactional
    public MapaResponse atualizar(Long id, AtualizarMapaRequest request) {
        var mapa = buscarMapa(id);
        var nome = request != null && request.nome() != null ? request.nome() : mapa.getNome();
        validarTamanho(nome, "Nome do mapa");

        var labels = request == null ? null : request.labels();
        var top = labelAtualizado(labels, labels == null ? null : labels.top(), mapa.getLabelTop());
        var bottom = labelAtualizado(labels, labels == null ? null : labels.bottom(), mapa.getLabelBottom());
        var left = labelAtualizado(labels, labels == null ? null : labels.left(), mapa.getLabelLeft());
        var right = labelAtualizado(labels, labels == null ? null : labels.right(), mapa.getLabelRight());
        mapa.atualizar(nome, top, bottom, left, right);
        mapaRepository.saveAndFlush(mapa);

        return responder(mapa, celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(id));
    }

    @Transactional
    public MapaResponse atualizarCelula(Long id, String posicaoRecebida, AtualizarCelulaRequest request) {
        var mapa = buscarMapa(id);
        var posicao = validarPosicao(mapa, posicaoRecebida);
        var itens = request == null ? List.<MapaCelulaInput>of() : request.itens();
        if (itens.size() < 1 || itens.size() > 4) {
            throw MapaException.entradaInvalida("Cada posição deve ter entre 1 e 4 pisos");
        }

        var ids = new ArrayList<Long>(itens.size());
        var idsUnicos = new HashSet<Long>();
        for (var item : itens) {
            var pisoId = item == null ? null : item.pisoId();
            if (pisoId == null) {
                throw MapaException.entradaInvalida("Piso não encontrado");
            }
            if (!idsUnicos.add(pisoId)) {
                throw MapaException.entradaInvalida("Não repita o mesmo piso na posição");
            }
            ids.add(pisoId);
        }

        Map<Long, Piso> pisos = pisoRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Piso::getId, Function.identity()));
        if (pisos.size() != ids.size()) {
            throw MapaException.entradaInvalida("Piso não encontrado");
        }

        var novasCelulas = new ArrayList<MapaCelula>(itens.size());
        for (int ordem = 0; ordem < itens.size(); ordem++) {
            var item = itens.get(ordem);
            var piso = pisos.get(item.pisoId());
            var quantidade = MapaQuantidadeCalculator.calcular(item.m2(), item.caixas(), piso.getM2PorCaixa());
            novasCelulas.add(new MapaCelula(
                    mapa,
                    posicao,
                    ordem,
                    piso,
                    quantidade.m2(),
                    quantidade.caixas()));
        }

        celulaRepository.deleteAllByMapaIdAndPosicao(id, posicao);
        celulaRepository.flush();
        celulaRepository.saveAllAndFlush(novasCelulas);
        mapa.touch();
        mapaRepository.saveAndFlush(mapa);
        return responder(mapa, celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(id));
    }

    @Transactional
    public MapaResponse limparCelula(Long id, String posicaoRecebida) {
        var mapa = buscarMapa(id);
        var posicao = validarPosicao(mapa, posicaoRecebida);
        celulaRepository.deleteAllByMapaIdAndPosicao(id, posicao);
        mapa.touch();
        mapaRepository.saveAndFlush(mapa);
        return responder(mapa, celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(id));
    }

    @Transactional
    public void excluir(Long id) {
        var mapa = buscarMapa(id);
        mapaRepository.delete(mapa);
        atividadeService.registrar("mapa", "Mapa \"" + mapa.getNome() + "\" apagado", null);
    }

    private Mapa buscarMapa(Long id) {
        return id == null
                ? throwNaoEncontrado()
                : mapaRepository.findById(id).orElseThrow(MapaException::naoEncontrado);
    }

    private static Mapa throwNaoEncontrado() {
        throw MapaException.naoEncontrado();
    }

    private static String validarPosicao(Mapa mapa, String recebida) {
        var posicao = recebida == null ? "" : recebida.toUpperCase(Locale.ROOT);
        if (!posicao.matches("^[A-Z]\\d+$")) {
            throw MapaException.entradaInvalida("Posição inválida para este mapa");
        }
        int linha = posicao.charAt(0) - 'A';
        int coluna;
        try {
            coluna = Integer.parseInt(posicao.substring(1));
        } catch (NumberFormatException exception) {
            throw MapaException.entradaInvalida("Posição inválida para este mapa");
        }
        if (linha >= mapa.getLinhas() || coluna < 1 || coluna > mapa.getColunas()) {
            throw MapaException.entradaInvalida("Posição inválida para este mapa");
        }
        return posicao.substring(0, 1) + coluna;
    }

    private static MapaResponse responder(Mapa mapa, List<MapaCelula> itens) {
        var celulas = new LinkedHashMap<String, List<MapaCelulaResponse>>();
        for (var item : itens) {
            celulas.computeIfAbsent(item.getPosicao(), ignored -> new ArrayList<>())
                    .add(new MapaCelulaResponse(item.getPiso().getId(), item.getM2(), item.getCaixas()));
        }
        var labels = new MapaLabelsResponse(
                mapa.getLabelTop(),
                mapa.getLabelBottom(),
                mapa.getLabelLeft(),
                mapa.getLabelRight());
        return new MapaResponse(
                mapa.getId(),
                mapa.getNome(),
                mapa.getLinhas(),
                mapa.getColunas(),
                labels,
                celulas,
                mapa.getCreatedAt(),
                mapa.getUpdatedAt());
    }

    private static String labelNovo(String label) {
        var valor = label == null ? "" : label;
        validarTamanho(valor, "Rótulo do mapa");
        return valor;
    }

    private static String labelAtualizado(MapaLabelsRequest labels, String valor, String atual) {
        if (labels == null || valor == null) {
            return atual;
        }
        validarTamanho(valor, "Rótulo do mapa");
        return valor;
    }

    private static void validarTamanho(String valor, String campo) {
        if (valor.length() > 160) {
            throw MapaException.entradaInvalida(campo + " deve ter no máximo 160 caracteres");
        }
    }
}
